import { sheetCsvUrl } from "@/lib/parse";

export const dynamic = "force-dynamic";

/**
 * Trae el sheet desde el servidor: Google no manda cabeceras CORS en el
 * endpoint de export, así que el navegador solo no puede hacerlo.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  if (!raw) return Response.json({ error: "Falta el link del sheet." }, { status: 400 });

  const csvUrl = sheetCsvUrl(raw);
  if (!csvUrl) {
    return Response.json(
      { error: "No reconocí ese link. Pegá la URL completa del Google Sheets (la que tiene /spreadsheets/d/...)." },
      { status: 400 },
    );
  }
  if (new URL(csvUrl).hostname !== "docs.google.com") {
    return Response.json({ error: "Solo se puede importar desde docs.google.com." }, { status: 400 });
  }

  try {
    const res = await fetch(csvUrl, { redirect: "follow", cache: "no-store" });
    const text = await res.text();

    if (!res.ok || text.trimStart().startsWith("<")) {
      return Response.json(
        {
          error:
            "Google no devolvió el CSV. Revisá que el sheet esté compartido como «Cualquier persona con el enlace» (al menos como lector).",
        },
        { status: 502 },
      );
    }
    return Response.json({ csv: text, url: csvUrl });
  } catch {
    return Response.json({ error: "No pude conectarme a Google Sheets." }, { status: 502 });
  }
}
