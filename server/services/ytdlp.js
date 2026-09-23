const { spawn, execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp';

function translateYtDlpError(err) {
  const text = `${err.stderr || err.message || ''}`;

  if (/Private video/i.test(text)) {
    return new Error('Este video es privado y no se puede procesar.');
  }
  if (/Video unavailable/i.test(text)) {
    return new Error('El video no está disponible o fue eliminado.');
  }
  if (/Sign in to confirm/i.test(text)) {
    return new Error('YouTube requiere verificación adicional para este video y no puede procesarse automáticamente.');
  }
  if (/age.?restrict/i.test(text)) {
    return new Error('Este video tiene restricción de edad y no puede procesarse automáticamente.');
  }
  if (/Unsupported URL|is not a valid URL/i.test(text)) {
    return new Error('La URL proporcionada no es válida.');
  }
  if (/timed out|ETIMEDOUT/i.test(text)) {
    return new Error('La operación tardó demasiado tiempo. Intenta nuevamente.');
  }
  if (/command not found|ENOENT/i.test(text)) {
    return new Error('yt-dlp no está instalado o no se encuentra en el PATH del servidor.');
  }

  return new Error('No se pudo procesar el video. Verifica la URL e intenta de nuevo.');
}

async function getVideoInfo(url) {
  const args = ['--dump-json', '--no-warnings', '--no-playlist', '--skip-download', url];

  try {
    const { stdout } = await execFileAsync(YT_DLP_PATH, args, {
      maxBuffer: 1024 * 1024 * 20,
      timeout: 30000,
    });
    const data = JSON.parse(stdout);

    return {
      id: data.id,
      title: data.title,
      thumbnail: data.thumbnail,
      duration: data.duration || 0,
      uploader: data.uploader || '',
    };
  } catch (err) {
    throw translateYtDlpError(err);
  }
}

function downloadMedia({ url, type, quality, outputTemplate, onProgress }) {
  return new Promise((resolve, reject) => {
    const format =
      type === 'audio'
        ? 'bestaudio/best'
        : `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`;

    const args = ['-f', format, '--no-playlist', '--no-warnings', '-o', outputTemplate];

    if (type === 'video') {
      args.push('--merge-output-format', 'mp4');
    }

    args.push(url);

    const child = spawn(YT_DLP_PATH, args);
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      const match = text.match(/(\d{1,3}\.\d)%/);
      if (match && onProgress) {
        onProgress(parseFloat(match[1]));
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', () => {
      reject(new Error('No se pudo iniciar yt-dlp. Verifica que esté instalado en el servidor.'));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(translateYtDlpError({ stderr }));
      }
    });
  });
}

module.exports = { getVideoInfo, downloadMedia };
