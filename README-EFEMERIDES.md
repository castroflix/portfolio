# Widget "¿Sabías que...?" — Efemérides diarias

Sistema de curiosidades diarias automatizado con IA (Gemini), adaptado a
partir del proyecto original de Trans-Català Rodes S.L. Genera una
efeméride nueva cada día sin intervención humana: se publica en el widget
de portada y se crea una ficha permanente en el archivo (`/efemerides/`).

Coste: **0 €/mes** (GitHub Pages + GitHub Actions + nivel gratuito de la
API de Gemini).

## Archivos que forman el sistema

| Archivo | Qué hace |
|---|---|
| `config/site.json` | **Aquí se personaliza todo**: idioma, temática, categorías, nombre del sitio. |
| `scripts/generar-efemeride.mjs` | Llama a la API de Gemini, valida la respuesta y escribe los tres sitios siguientes. |
| `data/efemerides.json` | Historial completo en JSON. `script.js` lo lee para pintar la efeméride de hoy en portada. |
| `efemerides/_template.html` | Plantilla con placeholders que el script rellena cada día. |
| `efemerides/YYYY-MM-DD.html` | Una página nueva cada día, indexable, con URL propia y permanente. |
| `efemerides/index.html` | Listado del archivo; el script inserta la entrada nueva arriba del todo. |
| `efemerides/efemerides.css` | Estilos del widget, autocontenidos (con `var(--variable, valor-por-defecto)` para heredar los colores de tu web si existen). |
| `script.js` | Carga `data/efemerides.json` y pinta la tarjeta de la portada. |
| `.github/workflows/efemeride-diaria.yml` | Ejecuta el script cada día a las 06:30 UTC (y permite lanzarlo a mano). |

## Puesta en marcha (paso a paso)

1. **Consigue una API key gratuita de Gemini**: entra en [Google AI
   Studio](https://aistudio.google.com/), crea una API key (no pide
   tarjeta de crédito).
2. **Añádela como secreto del repositorio**: en tu repo de GitHub →
   `Settings` → `Secrets and variables` → `Actions` → `New repository
   secret` → nombre `GEMINI_API_KEY`, valor tu key.
3. **Edita `config/site.json`** con los datos de tu web (ver abajo).
4. **Sube los archivos** a tu repositorio y activa GitHub Pages
   (`Settings` → `Pages`).
5. **Lanza la primera ejecución a mano**: pestaña `Actions` →
   "Efeméride diaria" → `Run workflow`. A partir de ahí se ejecutará
   sola cada día.

## Cómo personalizarlo para otro idioma o temática

Todo vive en `config/site.json`:

```json
{
  "idioma": "español",
  "localeFecha": "es-ES",
  "zonaHoraria": "Europe/Madrid",
  "nombreSitio": "Nombre de tu web",
  "tematica": "descripción libre de la temática que quieres",
  "categorias": ["Categoría 1", "Categoría 2", "Categoría 3"],
  "urlSitio": "https://tuweb.github.io/",
  "modelo": "gemini-flash-latest"
}
```

- **`idioma`**: nombre del idioma tal cual se lo dices al modelo (p. ej.
  `"català"`, `"english"`, `"français"`).
- **`localeFecha`**: código de idioma/región para formatear fechas
  (`es-ES`, `en-US`, `ca-ES`...).
- **`tematica`**: descríbela libremente — es lo que más cambia el
  resultado. Ejemplos: *"fontanería, instalaciones de agua y
  calefacción, historia del oficio"*, *"jardinería, botánica, historia
  de la agricultura"*, *"mecánica del automóvil, historia de los
  motores"*.
- **`categorias`**: mantén 2-4 categorías de **bajo riesgo** (evita
  normativa, legislación o temas controvertidos) para que el sistema
  siga funcionando sin revisión humana diaria.

No hace falta tocar `generar-efemeride.mjs` para reutilizarlo en otra
web — solo este archivo de configuración.

## Mantenimiento habitual

- **Ver si ha fallado algún día**: pestaña `Actions` del repositorio —
  las ejecuciones fallidas salen en rojo.
- **Forzar una ejecución manual**: `Actions` → "Efeméride diaria" →
  `Run workflow`.
- **Rotar la API key**: `Settings` → `Secrets and variables` →
  `Actions`.

## Límites del nivel gratuito de Gemini

El script hace **1 llamada al día** por web. El nivel gratuito de
`gemini-flash-latest` permite muchas más peticiones diarias que eso, así
que una misma API key aguanta sin problema varias webs distintas
funcionando en paralelo, cada una con su propio repositorio y su propio
`config/site.json`.

## Diferencias respecto al proyecto original (Trans-Català Rodes)

- Todo el contenido generado y las plantillas están en español en vez de
  catalán, y ahora es configurable por idioma.
- El prompt y las categorías ya no están fijados a temática de
  transporte; se toman de `config/site.json`.
- Los nombres de campos del JSON se tradujeron: `any`→`anio`,
  `titol`→`titulo`, `text`→`texto`, `fonts`→`fuentes`, `nom`→`nombre`,
  `data`→`fecha`.
- El CSS del widget (`efemerides/efemerides.css`) es un archivo aparte
  y autocontenido (con variables con valor por defecto), en vez de
  vivir mezclado en el `style.css` general del sitio — así se puede
  copiar a cualquier web sin arrastrar el resto del sistema de diseño.
- El workflow ya incluye `git pull --rebase` antes del `push` para
  evitar el error de "rejected / non-fast-forward" si hay una
  ejecución manual y la automática coinciden.
