/*
  ui.js
  =====
  Ayudantes de interfaz que se usan en toda la app, para no repetir código:
  - seleccionar elementos del HTML
  - mostrar avisos cortos (toast)
  - abrir y cerrar la ventana modal
  - pedir confirmación antes de borrar
  - manejar fechas
*/

const UI = (() => {
  // Atajos para seleccionar elementos (como hace jQuery, pero sin librerías).
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

  // Escapa texto para meterlo en HTML sin riesgos (por si un nombre tiene < > & ").
  function esc(texto) {
    if (texto === null || texto === undefined) return "";
    return String(texto)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // Muestra un aviso flotante por 2 segundos.
  let toastTimer = null;
  function toast(mensaje) {
    const el = $("#toast");
    el.textContent = mensaje;
    el.classList.add("visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("visible"), 2000);
  }

  // ---------- Ventana modal ----------
  function abrirModal(html) {
    const fondo = $("#modal-fondo");
    const caja = $("#modal-caja");
    caja.innerHTML = html;
    fondo.classList.remove("oculto");
  }

  function cerrarModal() {
    $("#modal-fondo").classList.add("oculto");
    $("#modal-caja").innerHTML = "";
  }

  // Si tocás el fondo oscuro (fuera de la caja), se cierra el modal.
  document.addEventListener("DOMContentLoaded", () => {
    const fondo = $("#modal-fondo");
    fondo.addEventListener("click", (e) => {
      if (e.target === fondo) cerrarModal();
    });
  });

  // ---------- Confirmación (Sí / No) ----------
  // Devuelve una Promesa que se resuelve en true (confirmó) o false (canceló).
  function confirmar(mensaje, textoBoton = "Eliminar") {
    return new Promise((resolve) => {
      abrirModal(`
        <h3>¿Estás seguro?</h3>
        <p>${esc(mensaje)}</p>
        <div class="modal-acciones">
          <button class="boton" id="conf-no">Cancelar</button>
          <button class="boton boton-peligro" id="conf-si">${esc(textoBoton)}</button>
        </div>
      `);
      $("#conf-si").addEventListener("click", () => {
        cerrarModal();
        resolve(true);
      });
      $("#conf-no").addEventListener("click", () => {
        cerrarModal();
        resolve(false);
      });
    });
  }

  // ---------- Fechas ----------
  // Devuelve la fecha de hoy en formato "YYYY-MM-DD" (la que usan los <input date>).
  function hoyISO() {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  // Convierte "2026-06-17" en algo lindo de leer, ej: "17 jun 2026".
  function formatearFecha(iso) {
    if (!iso) return "";
    const meses = [
      "ene", "feb", "mar", "abr", "may", "jun",
      "jul", "ago", "sep", "oct", "nov", "dic",
    ];
    const [anio, mes, dia] = iso.split("-");
    return `${parseInt(dia, 10)} ${meses[parseInt(mes, 10) - 1]} ${anio}`;
  }

  return {
    $,
    $$,
    esc,
    toast,
    abrirModal,
    cerrarModal,
    confirmar,
    hoyISO,
    formatearFecha,
  };
})();
