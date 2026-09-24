FROM node:20-slim

# ffmpeg (recorte/conversión) + python3/pip (para instalar yt-dlp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Debian 12+ bloquea "pip install" a nivel de sistema por PEP 668;
# --break-system-packages es seguro aquí porque el contenedor es de un solo uso.
RUN pip3 install --no-cache-dir --break-system-packages -U yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/index.js"]
