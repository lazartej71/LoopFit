/*
  historial.js
  ============
  Maneja la sección "Historial":
  - Lista todos los días que entrenaste (las sesiones), ordenados del más
    reciente al más viejo.
  - Por cada día muestra: la fecha, la rutina y un resumen (ejercicios, series
    y volumen total = suma de peso × repeticiones).
  - Tocando un día se abre el detalle completo (cada ejercicio con sus series).
  - También podés eliminar un día entero.

  Solo mostramos las sesiones que tienen al menos una serie cargada, así no se
  llena de días "vacíos" que se crearon sin querer.
*/

const Historial = (() => {
  // ---------------------------------------------------------------------------
  // Dibujar la lista de días entrenados.
  // ---------------------------------------------------------------------------
  function render() {
    const cont = UI.$("#lista-historial");

    const sesiones = DB.all(`
      SELECT
        s.id    AS id,
        s.fecha AS fecha,
        r.nombre AS rutina,
        (SELECT COUNT(*) FROM series se WHERE se.sesion_id = s.id) AS total_series,
        (SELECT COUNT(DISTINCT se.ejercicio_nombre) FROM series se WHERE se.sesion_id = s.id) AS total_ejercicios,
        (SELECT COALESCE(SUM(se.peso * se.repeticiones), 0) FROM series se WHERE se.sesion_id = s.id) AS volumen
      FROM sesiones s
      LEFT JOIN rutinas r ON r.id = s.rutina_id
      WHERE (SELECT COUNT(*) FROM series se WHERE se.sesion_id = s.id) > 0
      ORDER BY s.fecha DESC, s.id DESC
    `);

    if (sesiones.length === 0) {
      cont.innerHTML = `
        <div class="vacio">
          <span class="emoji">📖</span>
          Todavía no hay entrenamientos registrados.<br />
          Cargá tu primer día desde la sección <b>Registro</b>.
        </div>`;
      return;
    }

    cont.innerHTML = sesiones
      .map(
        (s) => `
        <div class="tarjeta" data-accion="ver-sesion" data-id="${s.id}" style="cursor:pointer">
          <div class="tarjeta-titulo">
            <h3>${UI.formatearFecha(s.fecha)}</h3>
            <button class="boton-icono" data-accion="eliminar-sesion" data-id="${s.id}"
                    aria-label="Eliminar día">🗑️</button>
          </div>
          <p class="subtexto">
            ${s.rutina ? UI.esc(s.rutina) : "Rutina eliminada"}
          </p>
          <p class="subtexto">
            ${s.total_ejercicios} ejercicio(s) · ${s.total_series} serie(s) · ${Math.round(s.volumen)} kg de volumen
          </p>
        </div>`
      )
      .join("");
  }

  // ---------------------------------------------------------------------------
  // Ver el detalle de un día: cada ejercicio con todas sus series.
  // ---------------------------------------------------------------------------
  function verSesion(sesionId) {
    const sesion = DB.get(
      `SELECT s.fecha AS fecha, r.nombre AS rutina
       FROM sesiones s LEFT JOIN rutinas r ON r.id = s.rutina_id
       WHERE s.id = ?`,
      [sesionId]
    );

    // Traemos todas las series del día, en orden.
    const series = DB.all(
      `SELECT ejercicio_nombre, numero_serie, peso, repeticiones
       FROM series WHERE sesion_id = ?
       ORDER BY ejercicio_id, numero_serie`,
      [sesionId]
    );

    // Agrupamos las series por ejercicio (manteniendo el orden de aparición).
    const porEjercicio = {};
    const orden = [];
    series.forEach((s) => {
      const nombre = s.ejercicio_nombre || "Ejercicio";
      if (!porEjercicio[nombre]) {
        porEjercicio[nombre] = [];
        orden.push(nombre);
      }
      porEjercicio[nombre].push(s);
    });

    const cuerpo = orden
      .map((nombre) => {
        const filas = porEjercicio[nombre]
          .map(
            (s) => `
            <div class="serie-fila">
              <span class="serie-num">${s.numero_serie}</span>
              <span class="serie-dato">${s.peso ?? "-"} kg</span>
              <span class="serie-dato">${s.repeticiones ?? "-"} reps</span>
            </div>`
          )
          .join("");
        return `<div class="mt"><b>${UI.esc(nombre)}</b>${filas}</div>`;
      })
      .join("");

    UI.abrirModal(`
      <h3>${UI.formatearFecha(sesion.fecha)}</h3>
      <p class="subtexto">${sesion.rutina ? UI.esc(sesion.rutina) : "Rutina eliminada"}</p>
      ${cuerpo || `<p class="subtexto">Este día no tiene series.</p>`}
      <div class="modal-acciones">
        <button class="boton boton-primario" id="btn-cerrar-det">Cerrar</button>
      </div>
    `);
    UI.$("#btn-cerrar-det").addEventListener("click", UI.cerrarModal);
  }

  // Eliminar un día entero (con todas sus series, en cascada).
  async function eliminarSesion(sesionId) {
    const s = DB.get("SELECT fecha FROM sesiones WHERE id = ?", [sesionId]);
    const ok = await UI.confirmar(
      `Se eliminará el entrenamiento del ${UI.formatearFecha(s.fecha)} con todas sus series.`
    );
    if (!ok) return;
    DB.run("DELETE FROM sesiones WHERE id = ?", [sesionId]);
    UI.toast("Entrenamiento eliminado");
    render();
  }

  // ---------------------------------------------------------------------------
  // Un solo escuchador de clics para toda la lista.
  // ---------------------------------------------------------------------------
  function conectarEventos() {
    UI.$("#lista-historial").addEventListener("click", (e) => {
      const boton = e.target.closest("[data-accion]");
      if (!boton) return;
      const accion = boton.dataset.accion;
      const id = Number(boton.dataset.id);

      if (accion === "eliminar-sesion") {
        eliminarSesion(id);
      } else if (accion === "ver-sesion") {
        verSesion(id);
      }
    });
  }

  return {
    render,
    conectarEventos,
  };
})();
