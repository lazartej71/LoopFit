# 🏋️ LoopFit

App web para llevar el seguimiento de tus entrenamientos de gimnasio.
Funciona en el celular como **PWA** (se instala como una app), guarda los datos
en tu propio dispositivo y se puede usar **sin internet**.

Está hecha **solo con HTML, CSS y JavaScript puro** (sin frameworks). La base de
datos es **SQLite** corriendo dentro del navegador con [sql.js](https://sql.js.org/)
(SQLite compilado a WebAssembly), y los datos se guardan en **IndexedDB** para que
no se pierdan al cerrar o recargar.

---

## ✨ Funcionalidades

- **Rutinas:** crear, editar y eliminar rutinas (ej: Push, Pull, Pierna) y los
  ejercicios de cada una.
- **Registro diario:** elegís una fecha y una rutina, y cargás tus series
  (peso + repeticiones) por ejercicio. Podés ver el **historial** de días
  anteriores de cada ejercicio para seguir tu progreso.
- **PR (records personales):** definís un ejercicio principal por grupo muscular
  (ej: Pecho → Press de banca) y registrás tu mejor marca con su fecha y su historial.
- **Modo claro / oscuro** y diseño pensado para usar con una mano en el gimnasio.

---

## 📁 Estructura del proyecto

```
.
├── index.html            ← La página principal
├── manifest.json         ← Datos de la PWA (nombre, íconos, colores)
├── service-worker.js     ← Hace que funcione offline y se actualice sola
├── vercel.json           ← Config de Vercel (tipo MIME del .wasm y caché)
├── css/
│   └── styles.css        ← Todos los estilos
├── js/
│   ├── db.js             ← Base de datos (SQLite + IndexedDB)
│   ├── ui.js             ← Ayudantes de interfaz (modales, avisos, fechas)
│   ├── rutinas.js        ← Sección Rutinas
│   ├── registro.js       ← Sección Registro diario
│   ├── pr.js             ← Sección PR
│   └── app.js            ← Arranca todo y conecta las partes
├── assets/
│   ├── sql-wasm.js       ← Librería sql.js (local, no usa CDN)
│   └── sql-wasm.wasm     ← SQLite compilado a WebAssembly
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png
```

---

## 💻 Cómo correr la app localmente

⚠️ **Importante:** no alcanza con hacer doble clic en `index.html`. El service
worker y el `.wasm` necesitan abrirse desde un **servidor web** (`http://...`),
no desde `file://`. Es muy fácil, elegí una opción:

### Opción A — Extensión "Live Server" de VS Code (la más simple)
1. Instalá la extensión **Live Server** en VS Code.
2. Clic derecho sobre `index.html` → **"Open with Live Server"**.
3. Se abre en `http://127.0.0.1:5500` o similar.

### Opción B — Con Node (ya lo tenés instalado)
En una terminal, dentro de la carpeta del proyecto:
```bash
npx serve
```
Y abrís la dirección que te muestre (ej: `http://localhost:3000`).

### Opción C — Con Python
```bash
python -m http.server 8000
```
Y abrís `http://localhost:8000`.

---

## 📲 Cómo instalarla en el celular como PWA

Primero tiene que estar publicada (ver la sección de Vercel) o accesible por
`http://` en tu red. Después:

**En Android (Chrome):**
1. Abrí la URL de la app.
2. Tocá el menú **⋮** (arriba a la derecha).
3. Elegí **"Agregar a la pantalla de inicio"** / **"Instalar app"**.

**En iPhone (Safari):**
1. Abrí la URL de la app en **Safari**.
2. Tocá el botón **Compartir** (el cuadrado con la flecha hacia arriba).
3. Elegí **"Agregar a inicio"**.

Listo: te queda el ícono de la mancuerna como si fuera una app más. 🎉

---

## ☁️ Cómo desplegarla en Vercel (paso a paso, primera vez)

La idea: subís el código a **GitHub** y lo conectás con **Vercel**. A partir de
ahí, cada vez que hagas `git push`, Vercel **vuelve a publicar solo**.

### 1) Subir el proyecto a GitHub
Ver la sección **"Git y GitHub"** más abajo. Cuando termines, vas a tener el
repo en `https://github.com/TU-USUARIO/loopfit` (o el nombre que le pongas).

### 2) Importar el repo en Vercel
1. Entrá a [vercel.com](https://vercel.com) y registrate/iniciá sesión
   **con tu cuenta de GitHub**.
2. Tocá **"Add New..." → "Project"**.
3. En la lista de repos, buscá tu repo y tocá **"Import"**.
4. En la configuración:
   - **Framework Preset:** elegí **"Other"** (es un sitio estático, no usa framework).
   - **Build Command:** dejalo **vacío**.
   - **Output Directory:** dejalo **vacío** (o `.`).
   - **Root Directory:** dejalo como está (la raíz del repo).
5. Tocá **"Deploy"** y esperá unos segundos.

### 3) Tu URL pública
Cuando termine, Vercel te da una dirección tipo:
```
https://loopfit-tu-usuario.vercel.app
```
Esa es la URL que abrís en el celular para instalar la PWA. ✅

A partir de ahora, cada `git push` a la rama principal **redespliega solo**.

---

## 🔄 Cómo funciona la actualización automática

No tenés que reinstalar la app ni borrar la caché a mano. Funciona así:

- El **HTML, CSS y JS** se piden **primero a la red**: si hay internet, siempre
  ves la versión más nueva. Si no hay internet, se usa la copia guardada (offline).
- El archivo grande **`.wasm`** (que casi nunca cambia) se guarda en caché para
  que la app abra rápido y funcione offline.
- Cuando hay una versión nueva, aparece un cartelito azul **"Hay una versión nueva"**.
  Tocás **"Actualizar"** y la app se refresca sola.

### ¿Cuándo conviene subir el número de versión?
En `service-worker.js`, arriba de todo, hay una línea:
```js
const VERSION = "v1";
```
Cambiala a `"v2"`, `"v3"`, etc. **solo si cambiaste el archivo `.wasm`** (o querés
forzar que se borre toda la caché vieja). Para cambios normales de HTML/CSS/JS no
hace falta, porque esos se piden siempre a la red.

---

## 💾 Sobre tus datos

- Los datos se guardan **en el navegador de tu dispositivo** (IndexedDB). No se
  suben a ningún servidor.
- Por eso, los datos **no se sincronizan** entre el celular y la compu: cada
  dispositivo tiene los suyos.
- Si borrás los "datos de navegación" del sitio o desinstalás la PWA, se borran.

---


