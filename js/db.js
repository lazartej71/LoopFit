/*
  db.js
  =====
  Acá vive TODA la lógica de la base de datos.

  ¿Cómo funciona?
  - Usamos sql.js, que es SQLite (una base de datos de verdad) compilada a
    WebAssembly para que corra dentro del navegador.
  - La base vive en memoria mientras la app está abierta.
  - Para que los datos NO se pierdan al cerrar o recargar, exportamos la base
    a un archivo binario y lo guardamos en IndexedDB (un almacén del navegador).
  - Al abrir la app, leemos ese binario de IndexedDB y lo cargamos de nuevo.

  Más abajo dejamos un objeto global llamado "DB" con funciones simples para
  que el resto de la app pueda leer y escribir sin preocuparse por los detalles.
*/

// "Envolvemos" todo en una función para no ensuciar el espacio global del navegador.
const DB = (() => {
  // ---- Variables internas (privadas) ----
  let SQL = null; // El módulo de sql.js una vez inicializado.
  let db = null;  // La base de datos abierta (en memoria).

  // Nombres que usamos dentro de IndexedDB.
  const IDB_NOMBRE = "gymtrack-db"; // Nombre de la base de IndexedDB.
  const IDB_STORE = "sqlite";       // "Cajón" donde guardamos el binario.
  const IDB_KEY = "base";           // Clave bajo la que guardamos el binario.

  // ---------------------------------------------------------------------------
  // IndexedDB: tres ayudantes para abrir, leer y guardar el binario de SQLite.
  // IndexedDB usa "callbacks", así que los envolvemos en Promesas para poder
  // usar async/await, que es más fácil de leer.
  // ---------------------------------------------------------------------------

  function abrirIndexedDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NOMBRE, 1);
      // Esto se ejecuta solo la primera vez (o si cambia la versión): creamos el cajón.
      req.onupgradeneeded = () => {
        req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Lee el binario guardado (o null si todavía no hay nada).
  async function leerBinario() {
    const idb = await abrirIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // Guarda el binario (un Uint8Array) en IndexedDB.
  async function escribirBinario(bytes) {
    const idb = await abrirIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------------------------------------------------------------------------
  // Guardado con "debounce": si hacemos muchos cambios seguidos, no guardamos
  // 20 veces; esperamos un ratito (250 ms) y guardamos una sola vez. Así va más
  // rápido. Igual ofrecemos guardarYa() para forzar el guardado inmediato.
  // ---------------------------------------------------------------------------
  let guardarTimer = null;

  function guardar() {
    if (guardarTimer) clearTimeout(guardarTimer);
    guardarTimer = setTimeout(() => {
      guardarYa();
    }, 250);
  }

  async function guardarYa() {
    if (!db) return;
    if (guardarTimer) {
      clearTimeout(guardarTimer);
      guardarTimer = null;
    }
    const bytes = db.export(); // Exporta toda la base a un Uint8Array.
    await escribirBinario(bytes);
  }

  // ---------------------------------------------------------------------------
  // Esquema (las tablas). Usamos "IF NOT EXISTS" para que solo se creen una vez.
  // ---------------------------------------------------------------------------
  function crearTablas() {
    db.run(`
      -- Activamos las claves foráneas para que el borrado en cascada funcione.
      PRAGMA foreign_keys = ON;

      -- RUTINAS: ej. "Push", "Pull", "Pierna".
      CREATE TABLE IF NOT EXISTS rutinas (
        id     INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL
      );

      -- EJERCICIOS: pertenecen a una rutina.
      CREATE TABLE IF NOT EXISTS ejercicios (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        rutina_id      INTEGER NOT NULL,
        nombre         TEXT NOT NULL,
        grupo_muscular TEXT,
        orden          INTEGER DEFAULT 0,
        FOREIGN KEY (rutina_id) REFERENCES rutinas(id) ON DELETE CASCADE
      );

      -- SESIONES: un día de entrenamiento, asociado a una rutina.
      CREATE TABLE IF NOT EXISTS sesiones (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        rutina_id INTEGER,
        fecha     TEXT NOT NULL, -- formato "YYYY-MM-DD"
        FOREIGN KEY (rutina_id) REFERENCES rutinas(id) ON DELETE SET NULL
      );

      -- SERIES: cada serie de un ejercicio dentro de una sesión.
      -- Guardamos también el nombre del ejercicio para conservar el historial
      -- aunque después borres o renombres el ejercicio.
      CREATE TABLE IF NOT EXISTS series (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        sesion_id        INTEGER NOT NULL,
        ejercicio_id     INTEGER,
        ejercicio_nombre TEXT,
        numero_serie     INTEGER NOT NULL,
        peso             REAL,
        repeticiones     INTEGER,
        FOREIGN KEY (sesion_id)    REFERENCES sesiones(id)   ON DELETE CASCADE,
        FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id) ON DELETE SET NULL
      );

      -- PR_CONFIG: define UN ejercicio principal por grupo muscular.
      CREATE TABLE IF NOT EXISTS pr_config (
        grupo_muscular   TEXT PRIMARY KEY,
        ejercicio_nombre TEXT NOT NULL
      );

      -- PR: historial de records personales. El PR "actual" es el más reciente.
      CREATE TABLE IF NOT EXISTS pr (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        grupo_muscular   TEXT NOT NULL,
        ejercicio_nombre TEXT NOT NULL,
        peso             REAL,
        repeticiones     INTEGER,
        fecha            TEXT NOT NULL -- formato "YYYY-MM-DD"
      );
    `);
  }

  // La primera vez que se crea la base, cargamos algunos grupos musculares de
  // ejemplo para la sección de PR. Vos después los podés editar o borrar.
  function sembrarDatosIniciales() {
    const fila = get("SELECT COUNT(*) AS n FROM pr_config");
    if (fila && fila.n === 0) {
      const ejemplos = [
        ["Pecho", "Press de banca plano con barra"],
        ["Espalda", "Peso muerto"],
        ["Pierna", "Sentadilla"],
        ["Hombro", "Press militar"],
        ["Bíceps", "Curl con barra"],
      ];
      ejemplos.forEach(([grupo, ejercicio]) => {
        run("INSERT INTO pr_config (grupo_muscular, ejercicio_nombre) VALUES (?, ?)", [
          grupo,
          ejercicio,
        ]);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Funciones para consultar/modificar la base.
  // Usamos "?" como marcadores y le pasamos los valores en un arreglo. Así
  // evitamos errores y problemas de seguridad (inyección SQL).
  // ---------------------------------------------------------------------------

  // Devuelve TODAS las filas como arreglo de objetos: [{col: valor, ...}, ...]
  function all(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const filas = [];
    while (stmt.step()) {
      filas.push(stmt.getAsObject());
    }
    stmt.free();
    return filas;
  }

  // Devuelve la PRIMERA fila (o null si no hay nada).
  function get(sql, params = []) {
    const filas = all(sql, params);
    return filas.length > 0 ? filas[0] : null;
  }

  // Ejecuta un INSERT/UPDATE/DELETE. Devuelve el id de la última fila insertada.
  // Después de cada cambio, programamos el guardado en IndexedDB.
  function run(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
    guardar(); // Programa el guardado (debounce).
    const r = db.exec("SELECT last_insert_rowid() AS id");
    return r.length > 0 ? r[0].values[0][0] : null;
  }

  // ---------------------------------------------------------------------------
  // Inicialización: se llama una sola vez al arrancar la app.
  // ---------------------------------------------------------------------------
  async function init() {
    // 1) Cargamos sql.js. locateFile le dice dónde está el archivo .wasm local.
    SQL = await initSqlJs({
      locateFile: (archivo) => "assets/" + archivo,
    });

    // 2) Intentamos recuperar la base guardada en IndexedDB.
    const bytes = await leerBinario();

    if (bytes) {
      // Ya había datos: los cargamos.
      db = new SQL.Database(bytes);
    } else {
      // Primera vez: base vacía.
      db = new SQL.Database();
    }

    // 3) Aseguramos que las tablas existan y sembramos datos de ejemplo.
    db.run("PRAGMA foreign_keys = ON;");
    crearTablas();
    sembrarDatosIniciales();

    // 4) Guardamos por si recién creamos las tablas.
    await guardarYa();
  }

  // Guardamos antes de que la app pase a segundo plano o se cierre, para no
  // perder cambios que estaban esperando en el "debounce".
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") guardarYa();
  });
  window.addEventListener("pagehide", () => guardarYa());

  // ---------------------------------------------------------------------------
  // Esto es lo que queda "público" y puede usar el resto de la app.
  // ---------------------------------------------------------------------------
  return {
    init,      // Inicializar la base (al arrancar).
    all,       // Leer varias filas.
    get,       // Leer una fila.
    run,       // Insertar / actualizar / borrar.
    guardarYa, // Forzar el guardado inmediato.
  };
})();
