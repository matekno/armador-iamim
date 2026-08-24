# Armador de Iamim Noraim

App para armar los grupos de planificación de peulot y resolver los cambios de
ejecución, a partir de un Google Sheets de disponibilidades.

Nada está hardcodeado: los nombres, los días, la cantidad de días y hasta la
cantidad de eventos salen del sheet que importás.

---

# Tutorial

## Paso 1 — Armar el formulario

En [forms.google.com](https://forms.google.com), formulario en blanco.

**Primera pregunta: el nombre.**

- Tipo **Respuesta corta**.
- Título: `Nombre y Apellido`.
- Marcala como **obligatoria**.

**Una pregunta por día.** El título de cada pregunta es lo que después la app
lee como encabezado de columna, así que escribilo completo:

```
Viernes 11/09 TARDE
Sábado 12/09 MAÑANA
Sábado 12/09 TARDE
Domingo 13/09 MAÑANA
Domingo 20/09 TARDE
Lunes 21/09 MAÑANA
Lunes 21/09 TARDE
```

- El **día de la semana** es opcional pero queda más lindo en las tablas.
- La **fecha** sí importa: `11/09`, `11-09-2025` o `11 de septiembre`. De ahí
  sale el orden cronológico y el corte entre Rosh Hashaná y Iom Kipur.
- El **turno** (`MAÑANA` / `MEDIODÍA` / `TARDE` / `NOCHE`) también se detecta,
  y sirve para ordenar dos peulot del mismo día.

**Qué tipo de pregunta usar.** Cualquiera de estas tres anda; elegí una y usala
para todos los días:

| Tipo de pregunta | Qué queda en el sheet | Cómo lo lee la app |
|---|---|---|
| **Casillas de verificación** con una sola opción: `No puedo venir` | vacío o `No puedo venir` | vacío = puede |
| **Casillas de verificación** con una sola opción: `Puedo venir` | vacío o `Puedo venir` | vacío = no puede |
| **Opción múltiple** con `Sí` / `No` | `Sí` o `No` | explícito |

La primera es la más cómoda: el talmid sólo marca los días que **no** puede, y
si no marca nada es que puede todos.

> **Ojo con el orden de los días.** El corte entre eventos se detecta por el
> salto de fechas: los días de Rosh Hashaná tienen que ser consecutivos y tiene
> que haber al menos 3 días de hueco antes de los de Iom Kipur. Si tus fechas
> no dan eso, no importa: lo corregís a mano en la app.

## Paso 2 — Vincular la hoja de respuestas y compartirla

1. En el formulario, pestaña **Respuestas** → botón de Sheets → **Vincular a
   Hojas de cálculo** → *Crear una hoja de cálculo*. Te crea una hoja
   `Form_Responses` con `Marca temporal`, `Nombre y Apellido` y una columna por
   día.
2. En esa planilla: **Compartir** → *Acceso general* → **Cualquier persona con
   el enlace** → rol **Lector**.
3. **Copiar vínculo.**

No hace falta que borres la columna `Marca temporal` ni la del mail: la app las
ignora sola.

## Paso 3 — Importar

Abrí la app, solapa **Datos**, pegá el link en *Link del Google Sheets* y tocá
**Importar**. (Si preferís no compartir el sheet, podés copiar las celdas
directo de la planilla y pegarlas en el cuadro de abajo, o subir un `.csv`.)

Fijate en los tres carteles que aparecen y confirmá que entendió bien:

- **Nombres**: qué columna usó para los nombres y cuáles son los días.
- **Ignoré**: las columnas de metadata que descartó.
- **Lectura**: si la celda vacía significa "puede" o "no puede". Si quedó al
  revés, cambialo en la tarjeta **Lectura de las celdas** — se recalcula al
  instante y el contador *"Así queda: N de M casilleros cuentan como
  disponible"* te dice si acertaste.

A la derecha, en **Eventos y días**, revisá el corte entre Rosh Hashaná e Iom
Kipur. Podés renombrar los eventos y mover cualquier día de uno a otro con el
desplegable.

## Paso 4 — Armar los grupos

Solapa **Armado automático**:

1. Elegí el **tamaño ideal de grupo** (4 anda bien para ~20 talmidim).
2. Dejá *Repartir las peulot entre los días* prendido salvo que no te importe
   que se amontonen.
3. **Armar**. Te muestra una propuesta con las métricas arriba: cuántos dan sus
   dos peulot, cuántos ejecutan lo que planificaron, cuántos errores quedan.
4. Si no te gusta, tocá el **dado** para pedir otra variante, o subí la búsqueda
   a *Fino*.
5. **Aplicar** cuando estés conforme.

Si ya armaste algún grupo a mano y no querés que lo toque, tildalo en **Grupos a
respetar** antes de armar.

## Paso 5 — Ajustar a mano y resolver los cambios

Solapa **Grupos**. Cada grupo muestra quiénes lo **planifican** y, abajo, una
peulá por evento:

- El desplegable del día te dice cuántos del grupo pueden ese día (`3/4 pueden`).
- Abajo aparece quién la **da**. Los que no pueden ese día salen tachados y no
  se pueden tildar.
- Clickeando un nombre lo sacás o lo ponés en la ejecución (el grupo de 4 la
  puede dar entre 3).
- Con **+ sumar a alguien de otro grupo** entra un **cambio**: alguien que da
  una peulá que no planificó. La lista sólo muestra a los que pueden ese día y
  no están dando otra peulá en ese mismo turno.
- **Restablecer** vuelve al grupo original disponible ese día.

El botón **Recalcular cambios y suplencias** (panel izquierdo) rehace todos los
rosters de cero: primero cada uno con su grupo, y después reparte los cambios
para que todos lleguen a sus dos peulot.

Cada grupo lista sus propios errores en rojo y advertencias en amarillo.

## Paso 6 — Revisar y repartir

- **Calendario**: la agenda día por día — qué peulot se dan, quiénes las dan,
  quién quedó libre ese día (útil para resolver un cambio a mano) y una tabla de
  estado por talmid.
- **Reportes**: texto listo para copiar y pegar en el grupo de WhatsApp — por
  grupo, por talmid, por día, sólo los cambios, o un CSV para volver al sheet.

## Paso 7 — Cuando siguen llegando respuestas

Volvé a **Datos**, dejá prendido *Conservar los grupos ya armados al reimportar*
y tocá **Actualizar desde el sheet** (o reimportá el link).

La app reengancha el armado por nombre y por día: los grupos, los días elegidos
y los cambios se conservan. Te avisa quién entró nuevo (queda sin grupo), quién
ya no está en el sheet, y marca en rojo si alguien quedó anotado un día que
ahora dice que no puede.

Todo se guarda en el navegador. Con **Descargar armado** te llevás un `.json`
que podés **Restaurar** en otra compu.

---

# Referencia

## El formato del sheet

| Marca temporal | Nombre y Apellido | Viernes 11/09 TARDE | Sábado 12/09 MAÑANA | … |
|---|---|---|---|---|
| 24/8 14:03 | Ailin Kassir | No puedo venir | | … |
| 24/8 14:05 | Eitan Moscovich | | No puedo venir | … |

La app **detecta sola** qué columna tiene los nombres y cuáles son días:

- **Columna de nombres**: la que tenga un encabezado tipo `Nombre`, `Apellido`,
  `Talmid`; si ninguno lo dice, la primera columna con texto que no sea
  metadata ni un día.
- **Columnas de días**: las que tengan una fecha en el encabezado, o cuyos
  valores sean mayormente sí/no.
- **Metadata ignorada**: `Marca temporal`, `Timestamp`, `Dirección de correo
  electrónico`, puntuación, `ID`. Te avisa cuáles ignoró.
- Si alguien **respondió dos veces**, se queda con la última respuesta y lo
  avisa.

Por eso funciona igual con una planilla armada a mano (nombres en la columna A,
sin encabezado) que con la hoja de respuestas de un Form.

## Qué significa una celda

Hay dos maneras opuestas de llenar la planilla. La app detecta cuál es mirando
los valores, y la corregís desde *Datos → Lectura de las celdas*:

- **Se marca quién SÍ puede** — la clásica: `TRUE` / `SÍ` / `X` en los días que
  puede; la celda vacía es que no puede.
- **Se marca quién NO puede** — el form junta sólo las ausencias: la celda dice
  `No puedo venir` y la vacía es que sí puede.

Frases sueltas tipo `No puedo venir`, `no voy`, `ausente` se leen como un "no"
en cualquiera de los dos modos.

## Las reglas que modela

**Duras**

- Un grupo de planificación tiene entre 2 y 5 talmidim (configurable).
- Cada grupo planifica una peulá por evento: una de RH y una de IK. Las dos las
  planifica el mismo grupo.
- Todo talmid tiene que **ejecutar al menos una de las peulot que planificó**.
  En la práctica: cuando el grupo elige sus dos días, cada miembro tiene que
  poder en al menos uno de los dos.

**Preferencias** (no siempre se pueden cumplir, por eso son preferencias)

1. Que en alguno de los dos días esté el grupo **entero** en la ejecución.
2. Que cada talmid dé **dos peulot**: idealmente las dos con su grupo.
3. Si no puede una, que dé un **cambio** en el otro evento (una de RH y una de
   IK).
4. Si tampoco, que dé las dos del mismo evento.
5. Dar una sola o ninguna es un error y la app lo marca en rojo.

Cuando algo es **inevitable** —alguien que no puede ningún día de Rosh Hashaná
va a dar sus dos peulot en Iom Kipur sí o sí— la app lo explica como nota gris
en vez de marcarlo como advertencia.

## Planificar ≠ ejecutar

Es la distinción central. Un grupo **planifica** dos peulot; cada peulá se
**ejecuta** un día concreto y la da un *roster*, que no es necesariamente el
grupo entero:

- si un miembro no puede ese día, sale del roster (el grupo de 4 la puede dar
  entre 3);
- ese miembro entra como **cambio** en la peulá de otro grupo, un día que sí
  puede, dando algo que no planificó;
- y otro talmid puede entrar como cambio en su lugar.

## Las solapas

- **Datos** — importar, ajustar la lectura de las celdas, los eventos y los
  días, y descargar/restaurar el armado en JSON.
- **Disponibilidades** — la matriz completa, con buscador, filtros y orden. Se
  clickean nombres para armar un grupo. El puntito marca el día en que cada uno
  da una peulá.
- **Grupos** — el editor de grupos, días, rosters y cambios.
- **Armado automático** — arma todo de cero y te deja revisar antes de aplicar.
- **Calendario** — la agenda por día y el estado de cada talmid.
- **Reportes** — textos para copiar/pegar y un CSV.

## Cómo resuelve el armado automático

Búsqueda con reinicios aleatorios más búsqueda local (mover y permutar talmidim
entre grupos), puntuando cada armado en este orden de peso:

1. cada talmid puede alguno de los dos días de su grupo (peso dominante);
2. días con el grupo entero presente;
3. cobertura total de los dos días;
4. todos llegan a sus dos peulot;
5. las dos peulot en eventos distintos;
6. menos cambios es mejor, y repartir las peulot entre los días.

Con 23 talmidim y 7 días cierra en menos de un segundo con 0 errores.

## Correr y deployar

```bash
npm install
npm run dev
```

Los datos viven en el `localStorage` del navegador: no hay backend ni base de
datos. Lo único que corre en el servidor es `/api/sheet`, que trae el CSV de
Google Sheets (el navegador solo no puede, Google no manda cabeceras CORS).

Deploy: `vercel` o conectando el repo desde el dashboard. No hace falta ninguna
variable de entorno.

## Scripts de verificación

```bash
npx tsx scripts/test-core.ts ruta/al/sheet.csv
npx tsx scripts/test-remap.ts ruta/al/sheet.csv
```

El primero importa, arma y muestra el diagnóstico completo. El segundo simula
que el sheet cambió (entra gente, se va gente, cambian disponibilidades) y
verifica que el armado se conserve al reimportar.

## Estructura

```
app/
  page.tsx            solapas y tarjetas de métricas
  api/sheet/route.ts  trae el CSV de Google (evita el CORS)
components/           una solapa por archivo + ui.tsx (primitivas)
lib/
  types.ts            el modelo de datos
  parse.ts            CSV, detección de columnas, fechas, eventos y polaridad
  model.ts            derivaciones y validación (errores/advertencias/notas)
  solver.ts           armado automático y reparto de cambios
  reports.ts          los textos exportables
  storage.ts          localStorage y reenganche al reimportar
  store.tsx           estado global (reducer + context)
```
