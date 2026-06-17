/*
  rutinas.js
  ==========
  Maneja la sección "Mis rutinas":
  - Crear, renombrar y eliminar rutinas.
  - Agregar, editar y eliminar ejercicios dentro de cada rutina.

  Toda la lógica de datos usa el objeto DB (de db.js).
  Toda la lógica de pantalla usa el objeto UI (de ui.js).
*/

const Rutinas = (() => {
  // Grupos musculares sugeridos (aparecen como autocompletado al escribir).
  const GRUPOS = [
    "Pecho", "Espalda", "Pierna", "Hombro",
    "Bíceps", "Tríceps", "Glúteo", "Core", "Antebrazo",
  ];

  // Devuelve el <datalist> con los grupos sugeridos (para reutilizarlo).
  function datalistGrupos() {
    const opciones = GRUPOS.map((g) => `<option value="${UI.esc(g)}">`).join("");
    return `<datalist id="grupos-sugeridos">${opciones}</datalist>`;
  }

  // ---------------------------------------------------------------------------
  // DIBUJAR la lista de rutinas en pantalla.
  // ---------------------------------------------------------------------------
  function render() {
    const cont = UI.$("#lista-rutinas");
    const rutinas = DB.all("SELECT * FROM rutinas ORDER BY id DESC");

    // Si no hay rutinas, mostramos un mensaje amable.
    if (rutinas.length === 0) {
      cont.innerHTML = `
        <div class="vacio">
          <span class="emoji">📋</span>
          Todavía no tenés rutinas.<br />
          Tocá el botón <b>+</b> para crear la primera.
        </div>`;
      return;
    }

    // Por cada rutina, armamos una tarjeta con sus ejercicios.
    cont.innerHTML = rutinas
      .map((r) => {
        const ejercicios = DB.all(
          "SELECT * FROM ejercicios WHERE rutina_id = ? ORDER BY orden, id",
          [r.id]
        );

        const itemsEjercicios = ejercicios
          .map(
            (e) => `
            <li>
              <span>
                ${UI.esc(e.nombre)}
                ${
                  e.grupo_muscular
                    ? `<span class="etiqueta-grupo">${UI.esc(e.grupo_muscular)}</span>`
                    : ""
                }
              </span>
              <span>
                <button class="boton-icono" data-accion="editar-ejercicio" data-id="${e.id}">✏️</button>
                <button class="boton-icono" data-accion="eliminar-ejercicio" data-id="${e.id}">🗑️</button>
              </span>
            </li>`
          )
          .join("");

        return `
          <div class="tarjeta">
            <div class="tarjeta-titulo">
              <h3>${UI.esc(r.nombre)}</h3>
              <span>
                <button class="boton-icono" data-accion="editar-rutina" data-id="${r.id}">✏️</button>
                <button class="boton-icono" data-accion="eliminar-rutina" data-id="${r.id}">🗑️</button>
              </span>
            </div>
            <p class="subtexto">${ejercicios.length} ejercicio(s)</p>
            <ul class="lista-ejercicios">${itemsEjercicios}</ul>
            <button class="boton boton-ancho mt" data-accion="agregar-ejercicio" data-id="${r.id}">
              + Agregar ejercicio
            </button>
          </div>`;
      })
      .join("");
  }

  // ---------------------------------------------------------------------------
  // RUTINAS: crear / editar / eliminar.
  // ---------------------------------------------------------------------------
  function formRutina(rutina = null) {
    const esEdicion = rutina !== null;
    UI.abrirModal(`
      <h3>${esEdicion ? "Editar rutina" : "Nueva rutina"}</h3>
      <label for="in-nombre-rutina">Nombre</label>
      <input id="in-nombre-rutina" type="text" placeholder="Ej: Push, Pull, Pierna"
             value="${esEdicion ? UI.esc(rutina.nombre) : ""}" />
      <div class="modal-acciones">
        <button class="boton" id="btn-cancelar">Cancelar</button>
        <button class="boton boton-primario" id="btn-guardar">Guardar</button>
      </div>
    `);

    const input = UI.$("#in-nombre-rutina");
    input.focus();

    UI.$("#btn-cancelar").addEventListener("click", UI.cerrarModal);
    UI.$("#btn-guardar").addEventListener("click", () => {
      const nombre = input.value.trim();
      if (!nombre) {
        UI.toast("Poné un nombre");
        return;
      }
      if (esEdicion) {
        DB.run("UPDATE rutinas SET nombre = ? WHERE id = ?", [nombre, rutina.id]);
        UI.toast("Rutina actualizada");
      } else {
        DB.run("INSERT INTO rutinas (nombre) VALUES (?)", [nombre]);
        UI.toast("Rutina creada");
      }
      UI.cerrarModal();
      render();
      // Si cambió la lista de rutinas, también actualizamos el menú de Registro.
      if (window.Registro) Registro.refrescarSelect();
    });
  }

  async function eliminarRutina(id) {
    const r = DB.get("SELECT nombre FROM rutinas WHERE id = ?", [id]);
    const ok = await UI.confirmar(
      `Se eliminará la rutina "${r.nombre}" y sus ejercicios. Las sesiones ya registradas no se borran.`
    );
    if (!ok) return;
    DB.run("DELETE FROM rutinas WHERE id = ?", [id]);
    UI.toast("Rutina eliminada");
    render();
    if (window.Registro) Registro.refrescarSelect();
  }

  // ---------------------------------------------------------------------------
  // EJERCICIOS: agregar / editar / eliminar.
  // ---------------------------------------------------------------------------
  function formEjercicio(rutinaId, ejercicio = null) {
    const esEdicion = ejercicio !== null;
    UI.abrirModal(`
      <h3>${esEdicion ? "Editar ejercicio" : "Nuevo ejercicio"}</h3>
      <label for="in-nombre-ej">Nombre del ejercicio</label>
      <input id="in-nombre-ej" type="text" placeholder="Ej: Press de banca"
             value="${esEdicion ? UI.esc(ejercicio.nombre) : ""}" />

      <label for="in-grupo-ej">Grupo muscular (opcional)</label>
      <input id="in-grupo-ej" type="text" list="grupos-sugeridos" placeholder="Ej: Pecho"
             value="${esEdicion ? UI.esc(ejercicio.grupo_muscular || "") : ""}" />
      ${datalistGrupos()}

      <div class="modal-acciones">
        <button class="boton" id="btn-cancelar">Cancelar</button>
        <button class="boton boton-primario" id="btn-guardar">Guardar</button>
      </div>
    `);

    const inNombre = UI.$("#in-nombre-ej");
    const inGrupo = UI.$("#in-grupo-ej");
    inNombre.focus();

    UI.$("#btn-cancelar").addEventListener("click", UI.cerrarModal);
    UI.$("#btn-guardar").addEventListener("click", () => {
      const nombre = inNombre.value.trim();
      const grupo = inGrupo.value.trim();
      if (!nombre) {
        UI.toast("Poné el nombre del ejercicio");
        return;
      }
      if (esEdicion) {
        DB.run("UPDATE ejercicios SET nombre = ?, grupo_muscular = ? WHERE id = ?", [
          nombre,
          grupo || null,
          ejercicio.id,
        ]);
        UI.toast("Ejercicio actualizado");
      } else {
        DB.run(
          "INSERT INTO ejercicios (rutina_id, nombre, grupo_muscular) VALUES (?, ?, ?)",
          [rutinaId, nombre, grupo || null]
        );
        UI.toast("Ejercicio agregado");
      }
      UI.cerrarModal();
      render();
    });
  }

  async function eliminarEjercicio(id) {
    const e = DB.get("SELECT nombre FROM ejercicios WHERE id = ?", [id]);
    const ok = await UI.confirmar(`¿Eliminar el ejercicio "${e.nombre}" de la rutina?`);
    if (!ok) return;
    DB.run("DELETE FROM ejercicios WHERE id = ?", [id]);
    UI.toast("Ejercicio eliminado");
    render();
  }

  // ---------------------------------------------------------------------------
  // Un solo "escuchador" de clics para toda la lista (delegación de eventos).
  // Lee el atributo data-accion del botón que tocaste y decide qué hacer.
  // ---------------------------------------------------------------------------
  function conectarEventos() {
    UI.$("#lista-rutinas").addEventListener("click", (e) => {
      const boton = e.target.closest("[data-accion]");
      if (!boton) return;
      const accion = boton.dataset.accion;
      const id = Number(boton.dataset.id);

      if (accion === "editar-rutina") {
        const r = DB.get("SELECT * FROM rutinas WHERE id = ?", [id]);
        formRutina(r);
      } else if (accion === "eliminar-rutina") {
        eliminarRutina(id);
      } else if (accion === "agregar-ejercicio") {
        formEjercicio(id);
      } else if (accion === "editar-ejercicio") {
        const ej = DB.get("SELECT * FROM ejercicios WHERE id = ?", [id]);
        formEjercicio(ej.rutina_id, ej);
      } else if (accion === "eliminar-ejercicio") {
        eliminarEjercicio(id);
      }
    });
  }

  // Se llama desde app.js cuando tocás el botón flotante (+) estando en Rutinas.
  function nuevoDesdeFlotante() {
    formRutina();
  }

  return {
    render,
    conectarEventos,
    nuevoDesdeFlotante,
  };
})();
