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
