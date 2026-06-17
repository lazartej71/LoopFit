/*
  app.js
  ======
  Es el "director de orquesta": arranca todo y conecta las partes.
  - Inicializa la base de datos.
  - Maneja la navegación entre las 3 secciones (Rutinas, Registro, PR).
  - Maneja el cambio de tema claro/oscuro.
  - Maneja el botón flotante (+).
  - Registra el Service Worker y avisa cuando hay una versión nueva.
*/

// Guardamos cuál es la vista activa para saber qué hace el botón flotante.
let vistaActiva = "rutinas";

// ---------------------------------------------------------------------------
// TEMA claro/oscuro
// ---------------------------------------------------------------------------
function aplicarTema(tema) {
  document.documentElement.setAttribute("data-tema", tema);
  // El botón muestra el ícono del tema al que vas a cambiar.
  UI.$("#btn-tema").textContent = tema === "oscuro" ? "☀️" : "🌙";
  // Cambiamos el color de la barra del navegador.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", tema === "oscuro" ? "#0b1220" : "#2563eb");
  localStorage.setItem("tema", tema);
}

function iniciarTema() {
  // Si ya elegiste un tema antes, lo respetamos. Si no, usamos el del sistema.
  let tema = localStorage.getItem("tema");
  if (!tema) {
    const prefiereOscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
    tema = prefiereOscuro ? "oscuro" : "claro";
  }
  aplicarTema(tema);

  UI.$("#btn-tema").addEventListener("click", () => {
    const actual = document.documentElement.getAttribute("data-tema");
    aplicarTema(actual === "oscuro" ? "claro" : "oscuro");
  });
}

// ---------------------------------------------------------------------------
// NAVEGACIÓN entre secciones
// ---------------------------------------------------------------------------
function cambiarVista(nombre) {
  vistaActiva = nombre;

  // Mostramos solo la sección elegida.
  UI.$$(".vista").forEach((v) => v.classList.remove("activa"));
  UI.$(`#vista-${nombre}`).classList.add("activa");

  // Marcamos el botón de navegación correspondiente.
  UI.$$(".nav button").forEach((b) => {
    b.classList.toggle("activa", b.dataset.vista === nombre);
  });

  // El botón flotante (+) solo aparece en Rutinas y PR.
  // En Registro no hace falta (se usa el botón "Cargar entrenamiento").
  UI.$("#btn-flotante").style.display = nombre === "registro" ? "none" : "flex";

  // Refrescamos el contenido de la vista por si cambió algo.
  if (nombre === "rutinas") Rutinas.render();
  if (nombre === "registro") Registro.refrescarSelect();
  if (nombre === "pr") PR.render();
}

function iniciarNavegacion() {
  UI.$$(".nav button").forEach((b) => {
    b.addEventListener("click", () => cambiarVista(b.dataset.vista));
  });

  // Botón flotante: depende de la vista en la que estés.
  UI.$("#btn-flotante").addEventListener("click", () => {
    if (vistaActiva === "rutinas") Rutinas.nuevoDesdeFlotante();
    else if (vistaActiva === "pr") PR.nuevoDesdeFlotante();
  });
}

// ---------------------------------------------------------------------------
// SERVICE WORKER (PWA): registro y aviso de actualización
// ---------------------------------------------------------------------------
function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then((reg) => {
        // Si se encuentra una versión nueva, esperamos a que esté lista y avisamos.
        reg.addEventListener("updatefound", () => {
          const nuevo = reg.installing;
          if (!nuevo) return;
          nuevo.addEventListener("statechange", () => {
            // "installed" + ya había un controller = hay una versión nueva esperando.
            if (nuevo.state === "installed" && navigator.serviceWorker.controller) {
              mostrarBannerActualizar(reg);
            }
          });
        });
      })
      .catch((err) => console.log("No se pudo registrar el Service Worker:", err));

    // Cuando el Service Worker nuevo toma el control, recargamos UNA vez
    // para que se vea la versión nueva.
    let recargando = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (recargando) return;
      recargando = true;
      window.location.reload();
    });
  });
}

// Muestra el banner azul "Hay una versión nueva". Al tocar "Actualizar",
// le decimos al Service Worker que se active ya mismo.
function mostrarBannerActualizar(reg) {
  const banner = UI.$("#banner-actualizar");
  banner.classList.remove("oculto");
  UI.$("#btn-actualizar").addEventListener("click", () => {
    if (reg.waiting) {
      reg.waiting.postMessage({ tipo: "SKIP_WAITING" });
    }
    banner.classList.add("oculto");
  });
}

// ---------------------------------------------------------------------------
// ARRANQUE
// ---------------------------------------------------------------------------
async function iniciarApp() {
  iniciarTema();
  iniciarNavegacion();
  registrarServiceWorker();

  // Mostramos un mensajito mientras carga la base (sql.js pesa un poco).
  UI.$("#lista-rutinas").innerHTML = `<div class="vacio">Cargando base de datos…</div>`;

  try {
    await DB.init(); // Inicializa SQLite + IndexedDB.
  } catch (err) {
    console.error(err);
    UI.$("#lista-rutinas").innerHTML = `
      <div class="vacio">😕 No se pudo cargar la base de datos.<br />Probá recargar la página.</div>`;
    return;
  }

  // Conectamos los eventos de cada sección (una sola vez).
  Rutinas.conectarEventos();
  PR.conectarEventos();
  Registro.init();

  // Dibujamos la primera vista.
  cambiarVista("rutinas");
}

// Cuando el HTML está listo, arrancamos.
document.addEventListener("DOMContentLoaded", iniciarApp);
