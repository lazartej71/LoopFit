/*
  pr.js
  =====
  Maneja la sección "Records personales (PR)":
  - Definís un ejercicio principal por grupo muscular (ej: Pecho -> Press de banca).
  - Registrás y actualizás tu PR (peso máximo y repeticiones) con su fecha.
  - Podés ver el historial de PRs anteriores de cada grupo.

  Usamos dos tablas:
  - pr_config: la definición (un ejercicio principal por grupo).
  - pr: el historial de marcas. El PR "actual" es el registro más reciente.
*/

const PR = (() => {
  // ---------------------------------------------------------------------------
  // Dibujar la lista de grupos musculares con su PR actual.
  // ---------------------------------------------------------------------------
  function render() {
    const cont = UI.$("#lista-pr");
    const grupos = DB.all("SELECT * FROM pr_config ORDER BY grupo_muscular");

    if (grupos.length === 0) {
      cont.innerHTML = `
        <div class="vacio">
          <span class="emoji">🏆</span>
          No hay grupos definidos.<br />
          Tocá <b>+</b> para agregar uno (ej: Pecho → Press de banca).
        </div>`;
      return;
    }

    cont.innerHTML = grupos
      .map((g) => {
        // El PR actual es el más reciente por fecha.
        const actual = DB.get(
          "SELECT * FROM pr WHERE grupo_muscular = ? ORDER BY fecha DESC, id DESC LIMIT 1",
          [g.grupo_muscular]
        );

        const bloquePR = actual
          ? `<div class="pr-actual">
               PR actual
               <div class="grande">${actual.peso ?? "-"} kg × ${actual.repeticiones ?? "-"}</div>
               <div class="subtexto">${UI.formatearFecha(actual.fecha)}</div>
             </div>`
          : `<div class="pr-actual"><span class="subtexto">Sin PR registrado todavía.</span></div>`;

        return `
          <div class="tarjeta" data-grupo="${UI.esc(g.grupo_muscular)}">
            <div class="tarjeta-titulo">
              <h3>${UI.esc(g.grupo_muscular)}</h3>
              <span>
                <button class="boton-icono" data-accion="editar-grupo">✏️</button>
                <button class="boton-icono" data-accion="eliminar-grupo">🗑️</button>
              </span>
            </div>
            <p class="subtexto">Ejercicio: ${UI.esc(g.ejercicio_nombre)}</p>
            ${bloquePR}
            <div class="fila">
              <button class="boton boton-primario" data-accion="registrar-pr">+ Registrar PR</button>
              <button class="boton" data-accion="ver-historial">Historial</button>
            </div>
          </div>`;
      })
      .join("");
  }

  // ---------------------------------------------------------------------------
  // Crear / editar un grupo (definición del ejercicio principal).
  // ---------------------------------------------------------------------------
  function formGrupo(config = null) {
    const esEdicion = config !== null;
    UI.abrirModal(`
      <h3>${esEdicion ? "Editar grupo" : "Nuevo grupo muscular"}</h3>
      <label for="in-grupo">Grupo muscular</label>
      <input id="in-grupo" type="text" placeholder="Ej: Pecho"
             value="${esEdicion ? UI.esc(config.grupo_muscular) : ""}" />

      <label for="in-ejercicio">Ejercicio principal</label>
      <input id="in-ejercicio" type="text" placeholder="Ej: Press de banca plano con barra"
             value="${esEdicion ? UI.esc(config.ejercicio_nombre) : ""}" />

      <div class="modal-acciones">
        <button class="boton" id="btn-cancelar">Cancelar</button>
        <button class="boton boton-primario" id="btn-guardar">Guardar</button>
      </div>
    `);

    UI.$("#in-grupo").focus();
    UI.$("#btn-cancelar").addEventListener("click", UI.cerrarModal);
    UI.$("#btn-guardar").addEventListener("click", () => {
      const grupo = UI.$("#in-grupo").value.trim();
      const ejercicio = UI.$("#in-ejercicio").value.trim();
      if (!grupo || !ejercicio) {
        UI.toast("Completá grupo y ejercicio");
        return;
      }

      if (esEdicion) {
        // Si cambió el nombre del grupo, también actualizamos su historial.
        if (grupo !== config.grupo_muscular) {
          // Evitamos chocar con otro grupo que ya tenga ese nombre.
          const existe = DB.get(
            "SELECT 1 AS x FROM pr_config WHERE grupo_muscular = ?",
            [grupo]
          );
          if (existe) {
            UI.toast("Ya existe un grupo con ese nombre");
            return;
          }
          DB.run("UPDATE pr SET grupo_muscular = ? WHERE grupo_muscular = ?", [
            grupo,
            config.grupo_muscular,
          ]);
        }
        DB.run(
          "UPDATE pr_config SET grupo_muscular = ?, ejercicio_nombre = ? WHERE grupo_muscular = ?",
          [grupo, ejercicio, config.grupo_muscular]
        );
        UI.toast("Grupo actualizado");
      } else {
        const existe = DB.get(
          "SELECT 1 AS x FROM pr_config WHERE grupo_muscular = ?",
          [grupo]
        );
        if (existe) {
          UI.toast("Ese grupo ya existe");
          return;
        }
        DB.run(
          "INSERT INTO pr_config (grupo_muscular, ejercicio_nombre) VALUES (?, ?)",
          [grupo, ejercicio]
        );
        UI.toast("Grupo agregado");
      }
      UI.cerrarModal();
      render();
    });
  }

  // ---------------------------------------------------------------------------
  // Registrar un nuevo PR para un grupo.
  // ---------------------------------------------------------------------------
  function registrarPR(grupo) {
    const config = DB.get("SELECT * FROM pr_config WHERE grupo_muscular = ?", [grupo]);

    UI.abrirModal(`
      <h3>Registrar PR — ${UI.esc(grupo)}</h3>
      <p class="subtexto">${UI.esc(config.ejercicio_nombre)}</p>
      <div class="fila">
        <div>
          <label>Peso (kg)</label>
          <input id="in-peso-pr" type="number" inputmode="decimal" step="0.5" min="0" placeholder="0" />
        </div>
        <div>
          <label>Reps</label>
          <input id="in-reps-pr" type="number" inputmode="numeric" min="0" placeholder="0" />
        </div>
      </div>
      <label for="in-fecha-pr">Fecha</label>
      <input id="in-fecha-pr" type="date" value="${UI.hoyISO()}" />

      <div class="modal-acciones">
        <button class="boton" id="btn-cancelar">Cancelar</button>
        <button class="boton boton-primario" id="btn-guardar">Guardar PR</button>
      </div>
    `);

    UI.$("#in-peso-pr").focus();
    UI.$("#btn-cancelar").addEventListener("click", UI.cerrarModal);
    UI.$("#btn-guardar").addEventListener("click", () => {
      const peso = UI.$("#in-peso-pr").value === "" ? null : parseFloat(UI.$("#in-peso-pr").value);
      const reps = UI.$("#in-reps-pr").value === "" ? null : parseInt(UI.$("#in-reps-pr").value, 10);
      const fecha = UI.$("#in-fecha-pr").value || UI.hoyISO();

      if (peso === null && reps === null) {
        UI.toast("Cargá peso y/o reps");
        return;
      }

      DB.run(
        `INSERT INTO pr (grupo_muscular, ejercicio_nombre, peso, repeticiones, fecha)
         VALUES (?, ?, ?, ?, ?)`,
        [grupo, config.ejercicio_nombre, peso, reps, fecha]
      );
      UI.cerrarModal();
      render();
      UI.toast("¡PR registrado! 💪");
    });
  }

  // ---------------------------------------------------------------------------
  // Ver el historial de PRs de un grupo (con opción de borrar registros).
  // ---------------------------------------------------------------------------
  function verHistorial(grupo) {
    const filas = DB.all(
      "SELECT * FROM pr WHERE grupo_muscular = ? ORDER BY fecha DESC, id DESC",
      [grupo]
    );

    let cuerpo;
    if (filas.length === 0) {
      cuerpo = `<p class="subtexto">Todavía no registraste ningún PR.</p>`;
    } else {
      cuerpo = filas
        .map(
          (p) => `
          <div class="serie-fila">
            <span class="serie-dato">${p.peso ?? "-"} kg × ${p.repeticiones ?? "-"}</span>
            <span class="subtexto">${UI.formatearFecha(p.fecha)}</span>
            <button class="boton-icono" data-accion="borrar-pr" data-id="${p.id}"
                    style="margin-left:auto">🗑️</button>
          </div>`
        )
        .join("");
    }

    UI.abrirModal(`
      <h3>🏆 ${UI.esc(grupo)}</h3>
      <p class="subtexto">Historial de PRs</p>
      <div id="hist-pr">${cuerpo}</div>
      <div class="modal-acciones">
        <button class="boton boton-primario" id="btn-cerrar-hist">Cerrar</button>
      </div>
    `);

    UI.$("#btn-cerrar-hist").addEventListener("click", UI.cerrarModal);

    // Permitir borrar un PR puntual desde el historial.
    UI.$("#hist-pr").addEventListener("click", (e) => {
      const boton = e.target.closest('[data-accion="borrar-pr"]');
      if (!boton) return;
      DB.run("DELETE FROM pr WHERE id = ?", [Number(boton.dataset.id)]);
      render();
      verHistorial(grupo); // Redibuja el historial actualizado.
      UI.toast("PR borrado");
    });
  }

  async function eliminarGrupo(grupo) {
    const ok = await UI.confirmar(
      `Se eliminará el grupo "${grupo}" y todo su historial de PRs.`
    );
    if (!ok) return;
    DB.run("DELETE FROM pr WHERE grupo_muscular = ?", [grupo]);
    DB.run("DELETE FROM pr_config WHERE grupo_muscular = ?", [grupo]);
    UI.toast("Grupo eliminado");
    render();
  }

  // ---------------------------------------------------------------------------
  // Un solo escuchador de clics para toda la lista de PR.
  // ---------------------------------------------------------------------------
  function conectarEventos() {
    UI.$("#lista-pr").addEventListener("click", (e) => {
      const boton = e.target.closest("[data-accion]");
      if (!boton) return;
      const tarjeta = boton.closest("[data-grupo]");
      const grupo = tarjeta ? tarjeta.dataset.grupo : null;
      const accion = boton.dataset.accion;

      if (accion === "registrar-pr") {
        registrarPR(grupo);
      } else if (accion === "ver-historial") {
        verHistorial(grupo);
      } else if (accion === "editar-grupo") {
        const config = DB.get("SELECT * FROM pr_config WHERE grupo_muscular = ?", [grupo]);
        formGrupo(config);
      } else if (accion === "eliminar-grupo") {
        eliminarGrupo(grupo);
      }
    });
  }

  // Se llama desde app.js cuando tocás el botón flotante (+) estando en PR.
  function nuevoDesdeFlotante() {
    formGrupo();
  }

  return {
    render,
    conectarEventos,
    nuevoDesdeFlotante,
  };
})();
