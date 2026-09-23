const express = require('express');
const path = require('path');
const fsp = require('fs/promises');

const { getVideoInfo } = require('../services/ytdlp');
const { runJob } = require('../services/processor');
const jobManager = require('../services/jobManager');
const { isValidYouTubeUrl, toSeconds, sanitizeQuality } = require('../utils/validate');

const router = express.Router();
const MAX_DURATION = Number(process.env.MAX_DURATION_SECONDS || 10800);

router.post('/info', async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: 'La URL proporcionada no parece ser un video válido de YouTube.' });
    }

    const info = await getVideoInfo(url.trim());

    if (info.duration > MAX_DURATION) {
      return res.status(400).json({
        error: `Este video excede la duración máxima permitida (${Math.floor(MAX_DURATION / 60)} minutos).`,
      });
    }

    res.json(info);
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudo obtener la información del video.' });
  }
});

router.post('/jobs', (req, res) => {
  const { url, type, quality, start, end } = req.body || {};

  if (!isValidYouTubeUrl(url)) {
    return res.status(400).json({ error: 'La URL proporcionada no parece ser un video válido de YouTube.' });
  }
  if (type !== 'audio' && type !== 'video') {
    return res.status(400).json({ error: 'Tipo de descarga inválido.' });
  }

  const safeQuality = sanitizeQuality(type, quality);
  const startSec = toSeconds(start);
  const endSec = toSeconds(end);

  if (endSec > 0 && startSec >= endSec) {
    return res.status(400).json({ error: 'El tiempo de inicio debe ser menor al tiempo final.' });
  }

  const job = jobManager.createJob();
  res.json({ jobId: job.id });

  runJob(job, { url: url.trim(), type, quality: safeQuality, start: startSec, end: endSec });
});

router.get('/jobs/:id/events', (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Trabajo no encontrado.' });
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
});

router.get('/jobs/:id/file', (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job || job.status !== 'done' || !job.filePath) {
    return res.status(404).json({ error: 'El archivo no está listo o ya fue descargado.' });
  }

  res.download(job.filePath, job.fileName, async () => {
    const jobDir = path.dirname(job.filePath);
    await fsp.rm(jobDir, { recursive: true, force: true }).catch(() => {});
    jobManager.removeJob(job.id);
  });
});

module.exports = router;
