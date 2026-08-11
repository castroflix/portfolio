// =============================================
// Efeméride del día ("¿Sabías que...?")
// -----------------------------------------------
// Los datos se cargan desde data/efemerides.json, que se
// regenera automáticamente una vez al día mediante un GitHub
// Action (.github/workflows/efemeride-diaria.yml) que llama a
// la API de Gemini.
//
// Formato de cada entrada del JSON:
// { categoria, anio, titulo, texto, fuentes: [{ nombre, url }], fecha? }
// El campo "fecha" (YYYY-MM-DD) solo existe en las entradas
// generadas automáticamente; las de semilla/ejemplo no lo tienen
// y se usan como reserva (fallback) si aún no se ha ejecutado
// ninguna generación.
//
// NOTA: como usamos fetch(), esta sección requiere que la web se
// sirva por http(s) (GitHub Pages, un servidor local, etc.); no
// funcionará abriendo index.html directamente con file://.
// =============================================

function fechaHoyISO() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function elegirEntradaDelDia(historial) {
  if (!Array.isArray(historial) || historial.length === 0) return null;

  const hoyISO = fechaHoyISO();

  // 1. Si hay una entrada generada exactamente hoy, es la que toca
  const deHoy = historial.find((e) => e.fecha === hoyISO);
  if (deHoy) return deHoy;

  // 2. Si no, pero ya hay entradas generadas (con campo "fecha"),
  //    mostramos la más reciente (por si el GitHub Action aún no
  //    se ha ejecutado hoy, p. ej. hace pocos minutos que es medianoche).
  const generadas = historial.filter((e) => e.fecha);
  if (generadas.length > 0) {
    generadas.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    return generadas[0];
  }

  // 3. Si todavía no se ha generado nunca ninguna entrada (p. ej. antes
  //    de la primera ejecución del workflow), rotamos entre las de
  //    ejemplo según el día del año.
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), 0, 0);
  const diasTranscurridos = Math.floor((hoy - inicio) / (1000 * 60 * 60 * 24));
  return historial[diasTranscurridos % historial.length];
}

function pintarEfemeride(entrada) {
  const hoy = new Date();
  const fechaFormateada = hoy.toLocaleDateString("es-ES", {
    day: "numeric", month: "long", year: "numeric"
  });

  document.getElementById("efemerideFecha").textContent = fechaFormateada;
  document.getElementById("efemerideCategoria").textContent = entrada.categoria;

  const tituloAnio = entrada.anio && entrada.anio !== "hoy"
    ? `${entrada.titulo} (${entrada.anio})`
    : entrada.titulo;
  document.getElementById("efemerideTitulo").textContent = tituloAnio;
  document.getElementById("efemerideTexto").textContent = entrada.texto;

  const fuentesEl = document.getElementById("efemerideFuentes");
  if (fuentesEl) {
    fuentesEl.innerHTML = "";
    if (entrada.fuentes && entrada.fuentes.length > 0) {
      fuentesEl.appendChild(document.createTextNode("Fuente: "));
      entrada.fuentes.forEach((f, i) => {
        if (i > 0) fuentesEl.appendChild(document.createTextNode(" · "));
        if (f.url) {
          const enlace = document.createElement("a");
          enlace.href = f.url;
          enlace.target = "_blank";
          enlace.rel = "noopener";
          enlace.textContent = f.nombre;
          fuentesEl.appendChild(enlace);
        } else {
          fuentesEl.appendChild(document.createTextNode(f.nombre));
        }
      });
    }
  }
}

async function inicializarEfemeride() {
  const contenedor = document.getElementById("efemerideCard");
  if (!contenedor) return;

  try {
    const respuesta = await fetch("data/efemerides.json", { cache: "no-store" });
    if (!respuesta.ok) throw new Error("No se ha podido cargar data/efemerides.json");
    const historial = await respuesta.json();

    const entrada = elegirEntradaDelDia(historial);
    if (!entrada) throw new Error("El archivo de datos está vacío.");

    pintarEfemeride(entrada);
  } catch (err) {
    console.error("Error cargando la efeméride del día:", err);
    // Ocultamos la tarjeta en lugar de mostrarla vacía
    contenedor.style.display = "none";
  }
}

inicializarEfemeride();
