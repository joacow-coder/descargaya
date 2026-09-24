const express = require('express');
const path = require('path');
const fsp = require('fs/promises');

const { getVideoInfo } = require('../services/ytdlp');
const { runJob } = require('../services/processor');
const jobManager = require('../services/jobManager');
const { isValidYouTubeUrl, toSeconds, sanitizeQuality } = require('../utils/validate');
const { ok, fail } = require('../utils/respond');

const router = express.Router();
const MAX_DURATION = Number(process.env.MAX_DURATION_SECONDS || 10800);

router.post('/info', async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!isValidYouTubeUrl(url)) {
      return fail(res, 'La URL proporcionada no parece ser un video válido de YouTube.', 400);
    }

    const info = await getVideoInfo(url.trim());

    if (info.duration > MAX_DURATION) {
      return fail(
        res,
        `Este video excede la duración máxima permitida (${Math.floor(MAX_DURATION / 60)} minutos).`,
        400
      );
    }

    ok(res, info);
  } catch (err) {
    // Cualquier fallo (yt-dlp, parseo, timeout, etc.) siempre responde JSON válido.
    fail(res, err.message || 'No se pudo obtener la información del video.', 400);
  }
});

router.post('/jobs', (req, res) => {
  try {
    const { url, type, quality, start, end } = req.body || {};

    if (!isValidYouTubeUrl(url)) {
      return fail(res, 'La URL proporcionada no parece ser un video válido de YouTube.', 400);
    }
    if (type !== 'audio' && type !== 'video') {
      return fail(res, 'Tipo de descarga inválido.', 400);
    }

    const safeQuality = sanitizeQuality(type, quality);
    const startSec = toSeconds(start);
    const endSec = toSeconds(end);

    if (endSec > 0 && startSec >= endSec) {
      return fail(res, 'El tiempo de inicio debe ser menor al tiempo final.', 400);
    }

    const job = jobManager.createJob();
    ok(res, { jobId: job.id });

    runJob(job, { url: url.trim(), type, quality: safeQuality, start: startSec, end: endSec });
  } catch (err) {
    fail(res, err.message || 'No se pudo iniciar el procesamiento.', 500);
  }
});

router.get('/jobs/:id/events', (req, res) => {
  try {
    const job = jobManager.getJob(req.params.id);
    if (!job) {
      return fail(res, 'Trabajo no encontrado.', 404);
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    send(job);

    const unsubscribe = jobManager.subscribe(job.id, (updatedJob) => {
      send(updatedJob);
      if (updatedJob.status === 'done' || updatedJob.status === 'error') {
        unsubscribe();
        res.end();
      }
    });

    req.on('close', unsubscribe);
  } catch (err) {
    // Si aún no se enviaron cabeceras SSE, respondemos JSON de error normal.
    if (!res.headersSent) {
      fail(res, err.message || 'No se pudo abrir el flujo de progreso.', 500);
    } else {
      res.end();
    }
  }
});

router.get('/jobs/:id/file', (req, res) => {
  try {
    const job = jobManager.getJob(req.params.id);
    if (!job || job.status !== 'done' || !job.filePath) {
      return fail(res, 'El archivo no está listo o ya fue descargado.', 404);
    }

    res.download(job.filePath, job.fileName, async () => {
      const jobDir = path.dirname(job.filePath);
      await fsp.rm(jobDir, { recursive: true, force: true }).catch(() => {});
      jobManager.removeJob(job.id);
    });
  } catch (err) {
    if (!res.headersSent) {
      fail(res, err.message || 'No se pudo descargar el archivo.', 500);
    }
  }
});

module.exports = router;
