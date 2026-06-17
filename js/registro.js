/*
  registro.js
  ===========
  Maneja la sección "Registro del día":
  - Elegís una fecha y una rutina, y cargás el entrenamiento de ese día.
  - Por cada ejercicio podés agregar varias series (peso en kg + repeticiones).
  - Podés borrar series sobre la marcha.
  - Podés ver el historial de días anteriores de cada ejercicio para ver progreso.

  Una "sesión" es un día de entrenamiento de una rutina concreta. Si volvés a
  cargar la misma rutina en la misma fecha, se reabre la sesión que ya existía.
*/

const Registro = (() => {
  // Guardamos acá qué sesión estamos editando ahora mismo.
  let sesionActual = null; // id de la sesión
  let rutinaActual = null; // id de la rutina de esa sesión

  // ---------------------------------------------------------------------------
  // Preparar la sección (se llama una vez al arrancar la app).
  // ---------------------------------------------------------------------------
  function init() {
    // Por defecto, la fecha es hoy.
    UI.$("#fecha-sesion").value = UI.hoyISO();
    refrescarSelect();

    UI.$("#btn-iniciar-sesion").addEventListener("click", cargarSesion);

    // Un solo escuchador de clics para todo lo que se dibuja dentro de la sesión.
    UI.$("#contenedor-sesion").addEventListener("click", manejarClic);
  }

  // Vuelve a llenar el menú desplegable de rutinas (se llama si cambian).
  function refrescarSelect() {
    const select = UI.$("#select-rutina");
    const elegido = select.value; // recordamos lo que estaba elegido
    const rutinas = DB.all("SELECT * FROM rutinas ORDER BY nombre");
    select.innerHTML =
      `<option value="">— Elegí una rutina —</option>` +
      rutinas
        .map((r) => `<option value="${r.id}">${UI.esc(r.nombre)}</option>`)
        .join("");
    select.value = elegido;
  }

  // ---------------------------------------------------------------------------
  // Cargar (o crear) la sesión del día elegido.
  // ---------------------------------------------------------------------------
  function cargarSesion() {
    const fecha = UI.$("#fecha-sesion").value;
    const rutinaId = Number(UI.$("#select-rutina").value);

    if (!fecha) {
      UI.toast("Elegí una fecha");
      return;
    }
    if (!rutinaId) {
      UI.toast("Elegí una rutina");
      return;
    }

    // ¿Ya existe una sesión de esa rutina en esa fecha? Si no, la creamos.
    let sesion = DB.get(
      "SELECT id FROM sesiones WHERE rutina_id = ? AND fecha = ?",
      [rutinaId, fecha]
    );
    if (!sesion) {
      const id = DB.run("INSERT INTO sesiones (rutina_id, fecha) VALUES (?, ?)", [
        rutinaId,
        fecha,
      ]);
      sesion = { id };
    }

    sesionActual = sesion.id;
    rutinaActual = rutinaId;
    render();
  }

  // ---------------------------------------------------------------------------
  // Dibujar los ejercicios de la sesión con sus series.
  // ---------------------------------------------------------------------------
  function render() {
    const cont = UI.$("#contenedor-sesion");

    if (!sesionActual) {
      cont.innerHTML = "";
      return;
    }

    const ejercicios = DB.all(
      "SELECT * FROM ejercicios WHERE rutina_id = ? ORDER BY orden, id",
      [rutinaActual]
    );

    if (ejercicios.length === 0) {
      cont.innerHTML = `
        <div class="vacio">
          <span class="emoji">🤔</span>
          Esta rutina no tiene ejercicios.<br />
          Agregalos desde la sección <b>Rutinas</b>.
        </div>`;
      return;
    }

    cont.innerHTML = ejercicios.map((ej) => tarjetaEjercicio(ej)).join("");
  }

  // Arma la tarjeta de UN ejercicio: sus series ya cargadas + el formulario
  // para agregar una serie nueva.
  function tarjetaEjercicio(ej) {
    const series = DB.all(
      "SELECT * FROM series WHERE sesion_id = ? AND ejercicio_id = ? ORDER BY numero_serie",
      [sesionActual, ej.id]
    );

    const filasSeries = series
      .map(
        (s) => `
        <div class="serie-fila">
          <span class="serie-num">${s.numero_serie}</span>
          <span class="serie-dato">${s.peso ?? "-"} kg</span>
          <span class="serie-dato">${s.repeticiones ?? "-"} reps</span>
          <button class="boton-icono" data-accion="eliminar-serie" data-id="${s.id}"
                  style="margin-left:auto">🗑️</button>
        </div>`
      )
      .join("");

    return `
      <div class="tarjeta" data-ejercicio="${ej.id}">
        <div class="tarjeta-titulo">
          <h3>${UI.esc(ej.nombre)}</h3>
          <button class="boton-icono" data-accion="ver-historial" data-id="${ej.id}"
                  aria-label="Ver historial">📈</button>
        </div>

        ${filasSeries || `<p class="subtexto">Sin series todavía.</p>`}

        <div class="fila mt">
          <div>
            <label>Peso (kg)</label>
            <input type="number" inputmode="decimal" step="0.5" min="0" class="in-peso" placeholder="0" />
          </div>
          <div>
            <label>Reps</label>
            <input type="number" inputmode="numeric" min="0" class="in-reps" placeholder="0" />
          </div>
          <button class="boton boton-primario fila-auto" data-accion="agregar-serie" data-id="${ej.id}">
            + Serie
          </button>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Manejar clics dentro de la sesión (agregar serie, borrar serie, historial).
  // ---------------------------------------------------------------------------
  function manejarClic(e) {
    const boton = e.target.closest("[data-accion]");
    if (!boton) return;
    const accion = boton.dataset.accion;
    const id = Number(boton.dataset.id);

    if (accion === "agregar-serie") {
      agregarSerie(id, boton);
    } else if (accion === "eliminar-serie") {
      eliminarSerie(id);
    } else if (accion === "ver-historial") {
      verHistorial(id);
    }
  }

  // Agrega una serie al ejercicio indicado, leyendo los inputs de su tarjeta.
  function agregarSerie(ejercicioId, boton) {
    const tarjeta = boton.closest("[data-ejercicio]");
    const inPeso = UI.$(".in-peso", tarjeta);
    const inReps = UI.$(".in-reps", tarjeta);

    const peso = inPeso.value === "" ? null : parseFloat(inPeso.value);
    const reps = inReps.value === "" ? null : parseInt(inReps.value, 10);

    if (peso === null && reps === null) {
      UI.toast("Cargá peso y/o reps");
      return;
    }

    // Buscamos el nombre actual del ejercicio (lo guardamos junto a la serie).
    const ej = DB.get("SELECT nombre FROM ejercicios WHERE id = ?", [ejercicioId]);

    // El número de serie siguiente = máximo actual + 1.
    const fila = DB.get(
      "SELECT COALESCE(MAX(numero_serie), 0) + 1 AS n FROM series WHERE sesion_id = ? AND ejercicio_id = ?",
      [sesionActual, ejercicioId]
    );

    DB.run(
      `INSERT INTO series (sesion_id, ejercicio_id, ejercicio_nombre, numero_serie, peso, repeticiones)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sesionActual, ejercicioId, ej.nombre, fila.n, peso, reps]
    );

    render();
    UI.toast("Serie agregada");
  }

  // Borra una serie y reordena los números para que queden 1, 2, 3...
  function eliminarSerie(serieId) {
    const s = DB.get("SELECT sesion_id, ejercicio_id FROM series WHERE id = ?", [serieId]);
    DB.run("DELETE FROM series WHERE id = ?", [serieId]);

    // Reordenamos las series restantes de ese ejercicio en esa sesión.
    const restantes = DB.all(
      "SELECT id FROM series WHERE sesion_id = ? AND ejercicio_id = ? ORDER BY numero_serie, id",
      [s.sesion_id, s.ejercicio_id]
    );
    restantes.forEach((r, i) => {
      DB.run("UPDATE series SET numero_serie = ? WHERE id = ?", [i + 1, r.id]);
    });

    render();
  }

  // ---------------------------------------------------------------------------
  // Historial de un ejercicio: muestra las series de días anteriores.
  // ---------------------------------------------------------------------------
  function verHistorial(ejercicioId) {
    const ej = DB.get("SELECT nombre FROM ejercicios WHERE id = ?", [ejercicioId]);

    // Traemos todas las series de ese ejercicio (por nombre), menos la sesión de hoy.
    const filas = DB.all(
      `SELECT s.fecha AS fecha, se.numero_serie AS numero_serie, se.peso AS peso, se.repeticiones AS repeticiones
       FROM series se
       JOIN sesiones s ON s.id = se.sesion_id
       WHERE se.ejercicio_nombre = ? AND se.sesion_id != ?
       ORDER BY s.fecha DESC, se.numero_serie ASC`,
      [ej.nombre, sesionActual ?? 0]
    );

    let cuerpo;
    if (filas.length === 0) {
      cuerpo = `<p class="subtexto">Todavía no hay registros anteriores de este ejercicio.</p>`;
    } else {
      // Agrupamos las series por fecha.
      const porFecha = {};
      filas.forEach((f) => {
        if (!porFecha[f.fecha]) porFecha[f.fecha] = [];
        porFecha[f.fecha].push(f);
      });

      cuerpo = Object.keys(porFecha)
        .map((fecha) => {
          const series = porFecha[fecha]
            .map(
              (s) =>
                `<div class="serie-fila">
                   <span class="serie-num">${s.numero_serie}</span>
                   <span class="serie-dato">${s.peso ?? "-"} kg</span>
                   <span class="serie-dato">${s.repeticiones ?? "-"} reps</span>
                 </div>`
            )
            .join("");
          return `<div class="mt"><b>${UI.formatearFecha(fecha)}</b>${series}</div>`;
        })
        .join("");
    }

    UI.abrirModal(`
      <h3>📈 ${UI.esc(ej.nombre)}</h3>
      <p class="subtexto">Historial de días anteriores</p>
      ${cuerpo}
      <div class="modal-acciones">
        <button class="boton boton-primario" id="btn-cerrar-hist">Cerrar</button>
      </div>
    `);
    UI.$("#btn-cerrar-hist").addEventListener("click", UI.cerrarModal);
  }

  return {
    init,
    refrescarSelect,
  };
})();
