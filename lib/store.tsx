"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { buildIndex, can, diagnose, type Diagnosis, type Index } from "./model";
import { isAvailable } from "./parse";
import { fillExecutions } from "./solver";
import { blankState, load, remapPlan, save } from "./storage";
import type { AppState, Dataset, Peula, Plan, Polarity, Settings } from "./types";
import { emptyPlan } from "./types";

type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "reset" }
  | { type: "setDataset"; dataset: Dataset; keepPlan: boolean }
  | { type: "setState"; state: AppState }
  | { type: "renameEvent"; eventId: string; name: string }
  | { type: "addEvent" }
  | { type: "moveSlot"; slotId: string; eventId: string }
  | { type: "setPolarity"; polarity: Polarity }
  | { type: "setSettings"; settings: Partial<Settings> }
  | { type: "setPlan"; plan: Plan }
  | { type: "createGroup"; memberIds: string[] }
  | { type: "deleteGroup"; groupId: string }
  | { type: "renameGroup"; groupId: string; name: string }
  | { type: "setMembers"; groupId: string; memberIds: string[] }
  | { type: "addMember"; groupId: string; talmidId: string }
  | { type: "removeMember"; groupId: string; talmidId: string }
  | { type: "setSlot"; groupId: string; eventId: string; slotId: string | null }
  | { type: "togglePerformer"; groupId: string; eventId: string; talmidId: string }
  | { type: "resetRoster"; groupId: string; eventId: string }
  | { type: "autoFill" };

const emptyPeulot = (ds: Dataset | null): Record<string, Peula> => {
  const out: Record<string, Peula> = {};
  for (const ev of ds?.events ?? []) out[ev.id] = { slotId: null, performerIds: [] };
  return out;
};

function withGroup(state: AppState, groupId: string, fn: (g: AppState["plan"]["groups"][number]) => void): AppState {
  const plan = structuredClone(state.plan);
  const g = plan.groups.find((x) => x.id === groupId);
  if (g) fn(g);
  return { ...state, plan };
}

/** Recalcula quiénes dan una peulá: miembros disponibles + suplentes que sigan pudiendo. */
function refreshRoster(state: AppState, groupId: string, eventId: string): AppState {
  if (!state.dataset) return state;
  const ds = state.dataset;
  return withGroup(state, groupId, (g) => {
    const p = g.peulot[eventId];
    if (!p) return;
    const t = (id: string) => ds.talmidim.find((x) => x.id === id);
    const suplentes = p.performerIds.filter((id) => !g.memberIds.includes(id) && can(t(id), p.slotId));
    const base = p.slotId ? g.memberIds.filter((m) => can(t(m), p.slotId)) : [];
    p.performerIds = [...new Set([...base, ...suplentes])];
  });
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
    case "setState":
      return action.state;
    case "reset":
      return blankState();

    case "setDataset": {
      if (action.keepPlan && state.dataset) {
        const { plan } = remapPlan(state.dataset, action.dataset, state.plan);
        return { dataset: action.dataset, plan };
      }
      return { dataset: action.dataset, plan: { ...emptyPlan(), settings: state.plan.settings } };
    }

    case "renameEvent": {
      if (!state.dataset) return state;
      const dataset = structuredClone(state.dataset);
      const ev = dataset.events.find((e) => e.id === action.eventId);
      if (ev) ev.name = action.name;
      return { ...state, dataset };
    }

    case "addEvent": {
      if (!state.dataset) return state;
      const dataset = structuredClone(state.dataset);
      const n = dataset.events.length + 1;
      dataset.events.push({ id: `ev${Date.now().toString(36)}`, name: `Evento ${n}`, tone: dataset.events.length });
      const plan = structuredClone(state.plan);
      for (const g of plan.groups) for (const ev of dataset.events) g.peulot[ev.id] ??= { slotId: null, performerIds: [] };
      return { ...state, dataset, plan };
    }

    case "moveSlot": {
      if (!state.dataset) return state;
      const dataset = structuredClone(state.dataset);
      const s = dataset.slots.find((x) => x.id === action.slotId);
      if (s) s.eventId = action.eventId;
      // Los eventos que se quedaron sin días se descartan.
      const usados = new Set(dataset.slots.map((x) => x.eventId));
      dataset.events = dataset.events.filter((e) => usados.has(e.id));
      const plan = structuredClone(state.plan);
      for (const g of plan.groups) {
        for (const [evId, p] of Object.entries(g.peulot)) {
          if (!usados.has(evId)) delete g.peulot[evId];
          else if (p.slotId) {
            const slot = dataset.slots.find((x) => x.id === p.slotId);
            if (slot && slot.eventId !== evId) {
              // El día se mudó de evento: la peulá lo sigue.
              delete g.peulot[evId];
              g.peulot[slot.eventId] = p;
            }
          }
        }
        for (const ev of dataset.events) g.peulot[ev.id] ??= { slotId: null, performerIds: [] };
      }
      return { ...state, dataset, plan };
    }

    case "setPolarity": {
      if (!state.dataset) return state;
      const dataset = structuredClone(state.dataset);
      dataset.polarity = action.polarity;
      for (const t of dataset.talmidim) {
        if (!t.raw) continue; // importado con una versión vieja: sin el texto crudo no se puede releer
        for (const s of dataset.slots) t.avail[s.id] = isAvailable(t.raw[s.id] ?? "", action.polarity);
      }
      return { ...state, dataset };
    }

    case "setSettings":
      return { ...state, plan: { ...state.plan, settings: { ...state.plan.settings, ...action.settings } } };

    case "setPlan":
      return { ...state, plan: action.plan };

    case "createGroup": {
      const plan = structuredClone(state.plan);
      const taken = new Set(plan.groups.flatMap((g) => g.memberIds));
      const memberIds = action.memberIds.filter((m) => !taken.has(m));
      if (!memberIds.length) return state;
      const n = plan.groups.length + 1;
      plan.groups.push({
        id: `g${Date.now().toString(36)}`,
        name: `Grupo ${n}`,
        memberIds,
        peulot: emptyPeulot(state.dataset),
      });
      return { ...state, plan };
    }

    case "deleteGroup": {
      const plan = structuredClone(state.plan);
      const gone = plan.groups.find((g) => g.id === action.groupId);
      plan.groups = plan.groups.filter((g) => g.id !== action.groupId);
      // Sus miembros dejan de figurar como suplentes en otras peulot.
      if (gone)
        for (const g of plan.groups)
          for (const p of Object.values(g.peulot))
            p.performerIds = p.performerIds.filter((id) => !gone.memberIds.includes(id) || g.memberIds.includes(id));
      return { ...state, plan };
    }

    case "renameGroup":
      return withGroup(state, action.groupId, (g) => (g.name = action.name));

    case "setMembers":
      return withGroup(state, action.groupId, (g) => (g.memberIds = action.memberIds));

    case "addMember": {
      const plan = structuredClone(state.plan);
      for (const g of plan.groups) g.memberIds = g.memberIds.filter((m) => m !== action.talmidId);
      const g = plan.groups.find((x) => x.id === action.groupId);
      if (g && !g.memberIds.includes(action.talmidId)) g.memberIds.push(action.talmidId);
      return { ...state, plan };
    }

    case "removeMember": {
      const next = withGroup(state, action.groupId, (g) => {
        g.memberIds = g.memberIds.filter((m) => m !== action.talmidId);
        for (const p of Object.values(g.peulot)) p.performerIds = p.performerIds.filter((m) => m !== action.talmidId);
      });
      return next;
    }

    case "setSlot": {
      const next = withGroup(state, action.groupId, (g) => {
        g.peulot[action.eventId] ??= { slotId: null, performerIds: [] };
        g.peulot[action.eventId].slotId = action.slotId;
      });
      return refreshRoster(next, action.groupId, action.eventId);
    }

    case "togglePerformer":
      return withGroup(state, action.groupId, (g) => {
        const p = g.peulot[action.eventId];
        if (!p) return;
        p.performerIds = p.performerIds.includes(action.talmidId)
          ? p.performerIds.filter((m) => m !== action.talmidId)
          : [...p.performerIds, action.talmidId];
      });

    case "resetRoster":
      return refreshRoster(
        withGroup(state, action.groupId, (g) => {
          const p = g.peulot[action.eventId];
          if (p) p.performerIds = p.performerIds.filter((id) => g.memberIds.includes(id));
        }),
        action.groupId,
        action.eventId,
      );

    case "autoFill": {
      if (!state.dataset) return state;
      const plan = structuredClone(state.plan);
      fillExecutions(plan, state.dataset, { keepManual: false });
      return { ...state, plan };
    }
  }
}

type Ctx = {
  state: AppState;
  dispatch: (a: Action) => void;
  ds: Dataset | null;
  idx: Index | null;
  diag: Diagnosis | null;
};

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, blankState);

  useEffect(() => {
    const saved = load();
    if (saved) dispatch({ type: "hydrate", state: saved });
  }, []);

  useEffect(() => {
    save(state);
  }, [state]);

  const value = useMemo<Ctx>(() => {
    const ds = state.dataset;
    return {
      state,
      dispatch,
      ds,
      idx: ds ? buildIndex(ds, state.plan) : null,
      diag: ds ? diagnose(ds, state.plan) : null,
    };
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore fuera del StoreProvider");
  return ctx;
}
