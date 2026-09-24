#!/bin/sh
set -e

# yt-dlp saca releases muy seguido para esquivar los cambios anti-bot de
# YouTube. Reinstalar en cada arranque evita quedar atado a la versión
# que haya quedado cacheada en la imagen de Docker de un build anterior.
echo "Actualizando yt-dlp a la última versión..."
pip3 install --no-cache-dir --break-system-packages -U yt-dlp \
  || echo "Aviso: no se pudo actualizar yt-dlp, se usa la versión ya instalada en la imagen."

exec node server/index.js
