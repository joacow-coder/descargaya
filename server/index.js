require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

const apiRouter = require('./routes/api');
const errorHandler = require('./middleware/errorHandler');
const jobManager = require('./services/jobManager');

const app = express();
const PORT = process.env.PORT || 3000;
const TMP_DIR = process.env.TMP_DIR || './tmp';
const JOB_TTL_MINUTES = Number(process.env.JOB_TTL_MINUTES || 30);

fs.mkdirSync(TMP_DIR, { recursive: true });

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', apiRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Recurso no encontrado.' });
});

app.use(errorHandler);

async function sweepTmpDir() {
  try {
    const entries = await fsp.readdir(TMP_DIR, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirPath = path.join(TMP_DIR, entry.name);
      const stat = await fsp.stat(dirPath);
      if (now - stat.mtimeMs > JOB_TTL_MINUTES * 60 * 1000) {
        await fsp.rm(dirPath, { recursive: true, force: true }).catch(() => {});
      }
    }
  } catch {
    // Directorio temporal aún no tiene contenido; se ignora.
  }
}

setInterval(() => {
  jobManager.sweepOldJobs(JOB_TTL_MINUTES * 60 * 1000);
  sweepTmpDir();
}, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`descargaya escuchando en http://localhost:${PORT}`);
});
