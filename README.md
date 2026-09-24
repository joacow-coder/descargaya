# DescargaYa

Centro de descargas y recortes multimedia de YouTube. Permite pegar el enlace de un video, previsualizarlo, recortar un fragmento opcional (inicio/fin) y descargarlo como **MP3** (128/192/320 kbps) o **MP4** (720p/1080p).

Backend en Node.js/Express que usa `yt-dlp` para la extracción y `ffmpeg` para el recorte y la conversión. Frontend estático (HTML + Tailwind CSS + JavaScript vanilla) con barra de progreso en tiempo real vía Server-Sent Events (SSE).

## Aviso legal

Esta herramienta es para uso personal. Descarga únicamente contenido sobre el que tengas derechos de uso o que YouTube permita descargar según sus Términos de Servicio. El autor no se responsabiliza del uso indebido de la aplicación.

## Estructura del proyecto

```
descargaya/
├── server/
│   ├── index.js                 # Punto de entrada del servidor Express
│   ├── routes/
│   │   └── api.js               # Endpoints /api/info, /api/jobs, SSE y descarga
│   ├── services/
│   │   ├── ytdlp.js             # Llamadas a yt-dlp (info + descarga con progreso)
│   │   ├── ffmpeg.js            # Recorte y conversión con ffmpeg
│   │   ├── processor.js         # Orquesta el pipeline completo de un trabajo
│   │   └── jobManager.js        # Estado en memoria + eventos de progreso
│   ├── middleware/
│   │   └── errorHandler.js      # Manejo centralizado de errores
│   └── utils/
│       └── validate.js          # Validación de URL, tiempos y calidad
├── public/
│   ├── index.html                # Interfaz (Tailwind CDN, dark mode)
│   ├── styles.css                # Estilos puntuales complementarios
│   └── app.js                    # Lógica del cliente (fetch + EventSource)
├── tmp/                           # Carpeta temporal de trabajo (se autolimpia)
├── Dockerfile                     # Imagen para desplegar en Render/Railway/Fly.io/Cloud Run
├── .dockerignore
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Requisitos del sistema (Linux Mint / Ubuntu/Debian)

- **Node.js 18+** y npm
- **ffmpeg**
- **yt-dlp**
- **git**

Instalación de dependencias del sistema:

```bash
sudo apt update
sudo apt install -y ffmpeg python3-pip git

# yt-dlp (opción recomendada, siempre actualizado vía pip)
python3 -m pip install --user -U yt-dlp

# Alternativa: binario standalone (si prefieres no usar pip)
# sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
# sudo chmod a+rx /usr/local/bin/yt-dlp
```

Verifica que ambos binarios estén disponibles en el PATH:

```bash
yt-dlp --version
ffmpeg -version
```

Si instalaste Node.js desde el repositorio de Mint y es una versión antigua, instala una versión reciente vía [nvm](https://github.com/nvm-sh/nvm):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

## Instalación del proyecto

```bash
# 1. Instalar dependencias de Node.js
npm install

# 2. Copiar variables de entorno
cp .env.example .env

# 3. (Opcional) Editar .env si necesitas cambiar puerto, rutas de binarios, etc.

# 4. Iniciar el servidor
npm start
```

La aplicación quedará disponible en **http://localhost:3000**.

Para desarrollo con reinicio automático al guardar cambios:

```bash
npm run dev
```

## Variables de entorno (`.env`)

| Variable                | Descripción                                              | Valor por defecto |
|--------------------------|-----------------------------------------------------------|--------------------|
| `PORT`                   | Puerto del servidor                                       | `3000`             |
| `TMP_DIR`                | Carpeta temporal para descargas/procesamiento             | `./tmp`            |
| `MAX_DURATION_SECONDS`   | Duración máxima de video permitida (segundos)              | `10800` (3 h)      |
| `JOB_TTL_MINUTES`        | Minutos antes de limpiar automáticamente archivos huérfanos | `30`               |
| `YT_DLP_PATH`            | Ruta/alias del binario `yt-dlp`                            | `yt-dlp`           |
| `FFMPEG_PATH`            | Ruta/alias del binario `ffmpeg`                            | `ffmpeg`           |
| `CORS_ORIGIN`            | Solo si el frontend corre en otro origen/puerto que el backend (ver [Arquitectura y rutas](#arquitectura-y-rutas-de-la-api)) | *(vacío = deshabilitado)* |

## Arquitectura y rutas de la API

**Importante:** este proyecto es una única app Express que sirve el frontend (`public/`) **y** la API (`/api/*`) desde el mismo servidor y el mismo puerto. El frontend llama a rutas **relativas** (`/api/info`, `/api/jobs`, ...), por lo que mientras accedas a la app desde `http://localhost:3000` (o el dominio donde despliegues `npm start`), nunca hay un problema de puertos ni de CORS — ambos viven en el mismo origen.

| Método | Ruta                     | Qué hace                                                        |
|--------|--------------------------|-------------------------------------------------------------------|
| `POST` | `/api/info`              | Analiza la URL con `yt-dlp` y devuelve título/miniatura/duración |
| `POST` | `/api/jobs`               | Crea un trabajo de descarga (audio o video, con recorte opcional) |
| `GET`  | `/api/jobs/:id/events`    | Stream SSE con el progreso en tiempo real del trabajo             |
| `GET`  | `/api/jobs/:id/file`      | Descarga el archivo final una vez el trabajo está `done`          |

Si ves un **404** al analizar una URL, la causa casi siempre es alguna de estas (no un bug en las rutas en sí, que ya están verificadas):

1. **Abriste `public/index.html` directamente en el navegador** (doble clic, `file://...`, o una extensión tipo "Live Server") en lugar de entrar a `http://localhost:3000`. En ese caso el navegador intenta pedir `/api/info` a ese otro origen, que no tiene esa ruta, y responde 404.
2. **El servidor Node no está corriendo** o corre en un puerto distinto al que usas en el navegador (revisa `PORT` en `.env` y la consola donde ejecutaste `npm start`).
3. **Desplegaste el frontend y el backend por separado** (por ejemplo frontend en Netlify/Vercel y backend en Render/Railway). En ese caso las rutas relativas `/api/...` apuntan al host del frontend, no al backend. Soluciones:
   - Recomendado: despliega todo junto (esta app ya sirve frontend + API desde el mismo proceso `npm start`).
   - Alternativa: si de verdad necesitas separarlos, cambia las llamadas de `public/app.js` para apuntar a la URL absoluta de tu backend y define `CORS_ORIGIN=https://tu-frontend.com` en el `.env` del backend para permitir la petición cross-origin.
4. **Publicaste el proyecto en Cloudflare Pages (o cualquier hosting estático puro / serverless tipo Workers).** Esta es la causa si ves 404 en *todas* las rutas `/api/*` sin excepción. Cloudflare Pages solo sirve archivos estáticos; sus "Functions" corren en el runtime de Cloudflare Workers, que **no** es Node.js: no soporta `child_process` ni puede ejecutar binarios externos como `yt-dlp` o `ffmpeg`, y no mantiene un proceso persistente ni sistema de archivos de escritura. El backend de esta app necesita eso, así que en Cloudflare Pages nunca va a responder — no importa cuánto se ajusten las rutas. Ver la sección [Despliegue en producción](#despliegue-en-producción) para desplegarlo en un hosting que sí soporte esto.

## Despliegue en producción

Esta app necesita un **proceso Node.js persistente** con `yt-dlp` y `ffmpeg` instalados en el mismo servidor, y espacio de disco de escritura temporal. Eso descarta hostings puramente estáticos/serverless (**Cloudflare Pages, Netlify, GitHub Pages, Vercel en su modo por defecto**). Necesitas un hosting que corra contenedores o procesos Node de larga duración: **Render, Railway, Fly.io, Google Cloud Run, un VPS (DigitalOcean, Linode, tu propia máquina), etc.**

El repo incluye un `Dockerfile` listo para eso — instala Node, `ffmpeg` y `yt-dlp` en la imagen, así que sirve para cualquiera de esos hostings sin configuración adicional.

### Probar la imagen Docker en local (recomendado antes de desplegar)

```bash
docker build -t descargaya .
docker run --rm -p 3000:3000 descargaya
```

Abre `http://localhost:3000` y repite el [protocolo de prueba](#protocolo-de-prueba-local-con-url-de-ejemplo) con la URL de ejemplo. Si funciona aquí, funcionará igual en cualquier hosting basado en contenedores.

### Desplegar en Render (gratis, el más simple con tu repo de GitHub)

1. Entra a [render.com](https://render.com) → **New** → **Web Service**.
2. Conecta tu repositorio `https://github.com/joacow-coder/descargaya`.
3. Render detecta el `Dockerfile` automáticamente (Environment: **Docker**). Si te pregunta, deja el **Dockerfile Path** en `./Dockerfile`.
4. En **Environment Variables**, agrega al menos `PORT=3000` (Render también inyecta su propio `PORT`; la app ya lo respeta vía `process.env.PORT`, así que puedes omitirlo).
5. Deploy. Cuando termine, tu app queda en `https://tu-app.onrender.com` — sirve frontend y API desde ahí mismo, sin necesidad de Cloudflare Pages ni de configurar CORS.

### Desplegar en Railway / Fly.io / Cloud Run

Todos detectan el `Dockerfile` del repo de forma similar:

```bash
# Railway (CLI)
railway login
railway init
railway up

# Fly.io (CLI)
fly launch          # detecta el Dockerfile, sigue el asistente
fly deploy

# Google Cloud Run
gcloud run deploy descargaya --source . --port 3000 --allow-unauthenticated
```

### ¿Y Cloudflare?

Si quieres seguir usando Cloudflare igual, dos opciones reales:
- Úsalo solo como DNS/proxy (naranja) apuntando a tu backend desplegado en Render/Railway/Fly.io — el dominio se ve con Cloudflare delante, pero quien responde `/api/*` es tu servidor Node real.
- **Cloudflare Containers** (producto en beta, de pago) sí soporta contenedores Docker persistentes y podría correr este `Dockerfile`, pero es una configuración avanzada y separada de Cloudflare Pages; no la cubrimos aquí porque Render/Railway resuelven lo mismo de forma más simple y con capa gratuita.

## Uso

1. Pega la URL de un video de YouTube y pulsa **Analizar**.
2. Revisa la miniatura, el título y la vista previa embebida.
3. (Opcional) Define minutos/segundos de inicio y fin para recortar. Déjalos en `0:00` para descargar el video completo.
4. Elige la pestaña **Audio** o **Video** y selecciona la calidad deseada.
5. Pulsa **Procesar y descargar**: verás una barra de progreso en tiempo real y, al finalizar, la descarga se iniciará automáticamente.

## Notas técnicas

- El recorte se aplica en el servidor con `ffmpeg` **después** de descargar el stream necesario, usando "output seeking" (`-ss`/`-to` después de `-i`) para un corte preciso a nivel de fotograma.
- El audio siempre se reconvierte a MP3 con la tasa de bits elegida usando `libmp3lame`.
- El video se descarga ya en contenedor MP4 (`--merge-output-format mp4`); solo se reencodea con `libx264`/`aac` cuando el usuario solicita un recorte.
- Los archivos temporales se guardan en carpetas por trabajo dentro de `TMP_DIR` y se eliminan automáticamente tras la descarga o por el barrido periódico (`JOB_TTL_MINUTES`).
- Los errores de `yt-dlp` (video privado, no disponible, restringido, URL inválida, etc.) se traducen a mensajes claros en español en la interfaz.

## Protocolo de prueba local (con URL de ejemplo)

Usa esta URL de prueba (incluye parámetros de playlist/radio, que la app ignora correctamente gracias a `--no-playlist`):

```
https://www.youtube.com/watch?v=ySTvUYhUeJ4&list=RDySTvUYhUeJ4&start_radio=1
```

**Paso 1 — Levantar el entorno:**

```bash
npm install
cp .env.example .env
npm start
```

Debes ver en la terminal: `descargaya escuchando en http://localhost:3000`.

**Paso 2 — Verificar el backend directamente (antes de tocar la interfaz):**

```bash
curl -s -X POST http://localhost:3000/api/info \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=ySTvUYhUeJ4&list=RDySTvUYhUeJ4&start_radio=1"}'
```

Respuesta esperada (HTTP 200, JSON con `success:true`):

```json
{"success":true,"id":"ySTvUYhUeJ4","title":"...","thumbnail":"...","duration":184,"uploader":"..."}
```

Si esto falla con 404, el problema es de enrutamiento/despliegue (ver [Arquitectura y rutas](#arquitectura-y-rutas-de-la-api)). Si responde con `success:false` y un mensaje de error, el problema es de `yt-dlp`/red — revisa la consola del servidor, ahí quedan registrados el intento y el `stderr` real.

**Paso 3 — Probar en la interfaz:**

1. Abre **http://localhost:3000** (no abras el archivo `index.html` directamente).
2. Pega la URL de prueba y pulsa **Analizar** → deben aparecer la miniatura, el título "Aitana - SUPERESTRELLA (Letra/Lyrics)" y la vista previa embebida.
3. Define un recorte, por ejemplo Inicio `0:10` y Fin `0:40`.
4. Pestaña **Audio**, calidad `192 kbps` → **Procesar y descargar** → debe verse la barra de progreso avanzar y descargarse un `descargaya.mp3` de ~30s.
5. Repite el análisis, cambia a pestaña **Video**, resolución `720p`, sin recorte → **Procesar y descargar** → debe descargarse `descargaya.mp4`.

Si algún paso falla, la interfaz mostrará un mensaje de error amigable (no un crash) y la consola del servidor tendrá el detalle técnico exacto.

## Solución de problemas

- **"yt-dlp no está instalado o no se encuentra en el PATH"**: confirma `yt-dlp --version` en la misma terminal/usuario con el que corre `npm start`, y que `~/.local/bin` (si usaste `pip install --user`) esté en tu `PATH`.
- **"No se pudo iniciar ffmpeg"**: instala ffmpeg con `sudo apt install ffmpeg` y verifica `ffmpeg -version`.
- **Videos con restricción de edad o "privados"**: no se pueden procesar automáticamente por políticas de YouTube.
- **El progreso se detiene**: revisa la consola del servidor (`npm start`) para ver el error real de `yt-dlp`/`ffmpeg`.

## Comandos Git para subir el proyecto a GitHub

El repositorio remoto `https://github.com/joacow-coder/descargaya.git` ya existe y está vacío. Desde la carpeta del proyecto (donde está este `README.md`), ejecuta en tu terminal de Linux Mint:

```bash
# 1. Inicializar git en esta carpeta (si aún no lo está)
git init

# 2. Renombrar la rama principal a "main"
git branch -M main

# 3. Conectar este repositorio local con tu repositorio de GitHub
git remote add origin https://github.com/joacow-coder/descargaya.git

# 4. Agregar todos los archivos del proyecto
git add .

# 5. Crear el commit inicial
git commit -m "Initial commit: DescargaYa - centro de descargas y recortes de YouTube"

# 6. Subir los cambios a GitHub
git push -u origin main
```

Si te pide autenticación, usa tu usuario de GitHub y un **Personal Access Token** (no tu contraseña) o configura autenticación por SSH.

### Si ya tenías el proyecto clonado en otra carpeta

Si prefieres partir de un `git clone` en lugar de `git init`:

```bash
git clone https://github.com/joacow-coder/descargaya.git
cd descargaya
# Copia aquí dentro los archivos del proyecto (server/, public/, package.json, etc.)
git add .
git commit -m "Initial commit: DescargaYa - centro de descargas y recortes de YouTube"
git push -u origin main
```

### Para futuros cambios

```bash
git add .
git commit -m "Descripción breve del cambio"
git push
```
