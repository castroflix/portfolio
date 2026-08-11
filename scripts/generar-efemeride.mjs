// =============================================================
// Genera la efeméride del día con la API gratuita de Gemini
// (Google AI Studio) y la añade a data/efemerides.json
//
// Se ejecuta desde el workflow de GitHub Actions
// (.github/workflows/efemeride-diaria.yml), una vez al día.
//
// Requiere la variable de entorno GEMINI_API_KEY (secret de
// GitHub, nunca se escribe en el código ni se sube al repositorio).
//
// Toda la personalización (idioma, temática, categorías, nombre
// del sitio...) vive en config/site.json — así este mismo script
// sirve para cualquier web, solo cambiando ese archivo.
// =============================================================

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const RUTA_CONFIG = path.resolve("config/site.json");
const RUTA_DATOS = path.resolve("data/efemerides.json");
const RUTA_PLANTILLA_ARCHIVO = path.resolve("efemerides/_template.html");
const RUTA_INDICE_ARCHIVO = path.resolve("efemerides/index.html");
const CARPETA_ARCHIVO = path.resolve("efemerides");
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Falta la variable de entorno GEMINI_API_KEY.");
  process.exit(1);
}

async function leerConfig() {
  const contenido = await readFile(RUTA_CONFIG, "utf-8");
  const config = JSON.parse(contenido);

  const camposObligatorios = [
    "idioma", "localeFecha", "zonaHoraria", "nombreSitio",
    "tematica", "categorias", "urlSitio", "modelo",
  ];
  for (const campo of camposObligatorios) {
    if (!(campo in config)) {
      throw new Error(`Falta el campo "${campo}" en config/site.json.`);
    }
  }
  if (!Array.isArray(config.categorias) || config.categorias.length === 0) {
    throw new Error('"categorias" en config/site.json debe ser una lista con al menos un elemento.');
  }
  return config;
}

// Escapa texto para poder insertarlo con seguridad dentro de HTML,
// tanto en contenido como dentro de atributos (title, meta description...).
function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncarTexto(texto, longitudMaxima) {
  const limpio = String(texto).trim();
  if (limpio.length <= longitudMaxima) return limpio;
  return limpio.slice(0, longitudMaxima - 1).replace(/\s+\S*$/, "") + "…";
}

// Sustituye cada placeholder {{CLAVE}} por su valor de forma literal
// (sin regex), para evitar que un placeholder quede mal insertado
// en medio de otra palabra.
function rellenarPlantilla(plantilla, valores) {
  let resultado = plantilla;
  for (const [clave, valor] of Object.entries(valores)) {
    resultado = resultado.split(`{{${clave}}}`).join(valor);
  }
  return resultado;
}

function fechaLargaLocal(config) {
  const hoy = new Date();
  const formateador = new Intl.DateTimeFormat(config.localeFecha, {
    timeZone: config.zonaHoraria,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return formateador.format(hoy);
}

function construirFuentesHtml(fuentes) {
  if (!fuentes || fuentes.length === 0) return "";
  const enlaces = fuentes.map((f) => {
    const nombre = escaparHtml(f.nombre || "");
    if (f.url) {
      const url = escaparHtml(f.url);
      return `<a href="${url}" target="_blank" rel="noopener">${nombre}</a>`;
    }
    return nombre;
  });
  return "Fuente: " + enlaces.join(" · ");
}

// Fecha de hoy según la zona horaria configurada, formato YYYY-MM-DD
function fechaHoyISO(config) {
  const hoy = new Date();
  const formateador = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formateador.format(hoy); // ya devuelve YYYY-MM-DD
}

async function leerHistorial() {
  try {
    const contenido = await readFile(RUTA_DATOS, "utf-8");
    const datos = JSON.parse(contenido);
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

function extraerJSON(texto) {
  // El modelo a veces envuelve la respuesta con ```json ... ```
  const limpio = texto.replace(/```json/gi, "").replace(/```/g, "").trim();
  const inicio = limpio.indexOf("{");
  const final = limpio.lastIndexOf("}");
  if (inicio === -1 || final === -1) {
    throw new Error("La respuesta del modelo no contiene un objeto JSON válido.");
  }
  return JSON.parse(limpio.slice(inicio, final + 1));
}

async function generarEfemeride(config, historial) {
  const titulosPrevios = historial
    .slice(-40)
    .map((e) => e.titulo)
    .filter(Boolean);

  const listaCategorias = config.categorias.map((c) => `"${c}"`).join(", ");

  const prompt = `
Eres un redactor que escribe contenido para la web "${config.nombreSitio}". Cada
día debes proponer UNA "efeméride del día" corta e interesante para una
sección tipo "¿Sabías que...?".

Reglas estrictas:
- Categoría: elige SOLO una de estas, sin excepciones: ${listaCategorias}.
- Temática: ${config.tematica}.
- NO trates normativa vigente, legislación, política ni ningún tema legal
  o controvertido. Debe ser un dato histórico, técnico o curioso de bajo
  riesgo.
- Redacta en ${config.idioma}, con un tono cercano pero cuidado, entre 2 y
  4 frases (unas 40-70 palabras).
- No repitas ninguno de estos temas ya publicados: ${titulosPrevios.length ? titulosPrevios.join(" | ") : "(ninguno todavía)"}.
- Usa SOLO hechos bien establecidos y consolidados (los que encontrarías en
  enciclopedias o sitios oficiales de fabricantes/instituciones). Si no
  estás seguro de un dato concreto (año exacto, cifra, nombre), elige otro
  hecho del que sí estés seguro.
- Cita 1 o 2 fuentes reales y conocidas (por ejemplo el sitio web oficial
  de un fabricante, una institución como un museo, o una organización del
  sector) con su URL real y conocida. Si no estás segurísimo de que la URL
  es correcta, pon solo el nombre de la fuente sin URL.

Responde ÚNICAMENTE con un objeto JSON, sin texto adicional, sin markdown,
con exactamente esta forma:
{
  "categoria": "...",
  "anio": "año o década de referencia, como texto, p. ej. 1971",
  "titulo": "título corto, sin punto final",
  "texto": "el texto de la efeméride",
  "fuentes": [{ "nombre": "nombre de la fuente", "url": "https://..." }]
}
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.modelo}:generateContent?key=${API_KEY}`;

  const respuesta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // NOTA: la búsqueda web (tools: [{ google_search: {} }]) se ha
      // quitado porque consume una cuota aparte que Google suele exigir
      // con facturación activada, incluso dentro del "nivel gratuito".
      // Sin búsqueda, el modelo responde solo con su conocimiento, lo
      // cual sigue siendo gratuito.
      generationConfig: { temperature: 0.9 },
    }),
  });

  if (!respuesta.ok) {
    const errTexto = await respuesta.text();
    throw new Error(`Error de la API de Gemini (${respuesta.status}): ${errTexto}`);
  }

  const datos = await respuesta.json();
  const texto = datos?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
  if (!texto) throw new Error("Respuesta vacía del modelo.");

  const entrada = extraerJSON(texto);

  // Validación mínima
  const campos = ["categoria", "anio", "titulo", "texto", "fuentes"];
  for (const campo of campos) {
    if (!(campo in entrada)) throw new Error(`Falta el campo "${campo}" en la respuesta del modelo.`);
  }

  return entrada;
}

async function generarPaginaArchivo(entrada, hoyISO, fechaTexto) {
  const plantilla = await readFile(RUTA_PLANTILLA_ARCHIVO, "utf-8");

  const tituloAnio = entrada.anio && entrada.anio !== "hoy"
    ? `${entrada.titulo} (${entrada.anio})`
    : entrada.titulo;

  const pagina = rellenarPlantilla(plantilla, {
    TITULO: escaparHtml(tituloAnio),
    TEXTO_CORTO: escaparHtml(truncarTexto(entrada.texto, 155)),
    FECHA: escaparHtml(`Publicado el ${fechaTexto}`),
    CATEGORIA: escaparHtml(entrada.categoria),
    TEXTO: escaparHtml(entrada.texto),
    FUENTES_HTML: construirFuentesHtml(entrada.fuentes),
  });

  const rutaArchivo = path.join(CARPETA_ARCHIVO, `${hoyISO}.html`);
  await writeFile(rutaArchivo, pagina, "utf-8");
  console.log(`Página de archivo creada: efemerides/${hoyISO}.html`);
}

async function agregarAIndiceArchivo(entrada, hoyISO, fechaTexto) {
  const indiceActual = await readFile(RUTA_INDICE_ARCHIVO, "utf-8");

  const tituloAnio = entrada.anio && entrada.anio !== "hoy"
    ? `${entrada.titulo} (${entrada.anio})`
    : entrada.titulo;

  const item = `        <article class="efemerides-lista-item">
          <span class="efemeride-fecha">${escaparHtml(fechaTexto)}</span>
          <span class="efemeride-categoria">${escaparHtml(entrada.categoria)}</span>
          <h3><a href="${hoyISO}.html">${escaparHtml(tituloAnio)}</a></h3>
          <p>${escaparHtml(truncarTexto(entrada.texto, 160))}</p>
        </article>
`;

  const marcador = `<div class="efemerides-lista">`;
  if (!indiceActual.includes(marcador)) {
    throw new Error(`No se ha encontrado '${marcador}' en efemerides/index.html; no se puede insertar la entrada nueva.`);
  }

  const nuevoIndice = indiceActual.replace(marcador, `${marcador}\n${item}`);
  await writeFile(RUTA_INDICE_ARCHIVO, nuevoIndice, "utf-8");
  console.log("efemerides/index.html actualizado con la entrada nueva.");
}

async function main() {
  const config = await leerConfig();
  const historial = await leerHistorial();
  const hoy = fechaHoyISO(config);

  // Si ya hay una entrada generada hoy (p. ej. reejecución manual), no se crea otra
  if (historial.some((e) => e.fecha === hoy)) {
    console.log(`Ya existe una efeméride para ${hoy}. No se genera ninguna nueva.`);
    return;
  }

  const entrada = await generarEfemeride(config, historial);
  entrada.fecha = hoy;

  // Las entradas nuevas se ponen al principio (la más reciente primero)
  const nuevoHistorial = [entrada, ...historial];

  await writeFile(RUTA_DATOS, JSON.stringify(nuevoHistorial, null, 2) + "\n", "utf-8");
  console.log(`Efeméride del ${hoy} generada y guardada: "${entrada.titulo}"`);

  const fechaTexto = fechaLargaLocal(config);
  await generarPaginaArchivo(entrada, hoy, fechaTexto);
  await agregarAIndiceArchivo(entrada, hoy, fechaTexto);
}

main().catch((err) => {
  console.error("Error generando la efeméride:", err);
  process.exit(1);
});
