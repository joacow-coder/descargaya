const { spawn } = require('child_process');

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

function toTimeArg(seconds) {
  return String(Math.max(0, Math.floor(seconds)));
}

/**
 * Recorta (opcional) y convierte un archivo fuente al formato final.
 * -ss/-to se colocan después de -i para un recorte preciso (output seeking).
 */
function processMedia({ inputPath, outputPath, type, quality, start, end }) {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-i', inputPath];

    if (start > 0) args.push('-ss', toTimeArg(start));
    if (end > 0) args.push('-to', toTimeArg(end));

    if (type === 'audio') {
      args.push('-vn', '-c:a', 'libmp3lame', '-b:a', `${quality}k`);
    } else {
      args.push(
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '20',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart'
      );
    }

    args.push(outputPath);

    const child = spawn(FFMPEG_PATH, args);
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', () => {
      reject(new Error('No se pudo iniciar ffmpeg. Verifica que esté instalado en el servidor.'));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Ocurrió un error al procesar el archivo con ffmpeg.'));
      }
    });
  });
}

module.exports = { processMedia };
