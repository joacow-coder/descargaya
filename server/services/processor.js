const path = require('path');
const fsp = require('fs/promises');

const { downloadMedia } = require('./ytdlp');
const { processMedia } = require('./ffmpeg');
const jobManager = require('./jobManager');

const TMP_DIR = process.env.TMP_DIR || './tmp';

async function runJob(job, { url, type, quality, start, end }) {
  const jobDir = path.join(TMP_DIR, job.id);
  await fsp.mkdir(jobDir, { recursive: true });

  try {
    jobManager.updateJob(job.id, {
      status: 'downloading',
      progress: 5,
      message: 'Descargando desde YouTube...',
    });

    await downloadMedia({
      url,
      type,
      quality,
      outputTemplate: path.join(jobDir, 'source.%(ext)s'),
      onProgress: (pct) => {
        jobManager.updateJob(job.id, { progress: Math.min(60, 5 + pct * 0.55) });
      },
    });

    const files = await fsp.readdir(jobDir);
    const sourceFile = files.find((f) => f.startsWith('source.'));
    if (!sourceFile) {
      throw new Error('No se pudo descargar el archivo fuente.');
    }
    const sourcePath = path.join(jobDir, sourceFile);

    const needsTrim = start > 0 || end > 0;
    const needsProcessing = type === 'audio' || needsTrim;

    let finalPath;
    let finalName;

    if (needsProcessing) {
      jobManager.updateJob(job.id, {
        status: 'processing',
        progress: 70,
        message: needsTrim ? 'Recortando y convirtiendo...' : 'Convirtiendo formato...',
      });

      const ext = type === 'audio' ? 'mp3' : 'mp4';
      finalName = `descargaya.${ext}`;
      finalPath = path.join(jobDir, finalName);

      await processMedia({ inputPath: sourcePath, outputPath: finalPath, type, quality, start, end });
    } else {
      finalName = `descargaya${path.extname(sourceFile)}`;
      finalPath = path.join(jobDir, finalName);
      await fsp.rename(sourcePath, finalPath);
    }

    jobManager.updateJob(job.id, {
      status: 'done',
      progress: 100,
      message: 'Listo para descargar.',
      filePath: finalPath,
      fileName: finalName,
    });
  } catch (err) {
    jobManager.updateJob(job.id, {
      status: 'error',
      progress: 0,
      message: err.message || 'Ocurrió un error inesperado.',
      error: err.message || 'Ocurrió un error inesperado.',
    });
    await fsp.rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { runJob };
