(() => {
  const analyzeForm = document.getElementById('analyze-form');
  const urlInput = document.getElementById('url-input');
  const analyzeBtn = document.getElementById('analyze-btn');
  const analyzeBtnLabel = document.getElementById('analyze-btn-label');
  const analyzeSpinner = document.getElementById('analyze-spinner');

  const errorBanner = document.getElementById('error-banner');
  const videoCard = document.getElementById('video-card');
  const videoPlayer = document.getElementById('video-player');
  const videoTitle = document.getElementById('video-title');
  const videoMeta = document.getElementById('video-meta');

  const startMin = document.getElementById('start-min');
  const startSec = document.getElementById('start-sec');
  const endMin = document.getElementById('end-min');
  const endSec = document.getElementById('end-sec');

  const tabButtons = document.querySelectorAll('.tab-btn');
  const audioPanel = document.getElementById('audio-panel');
  const videoPanel = document.getElementById('video-panel');
  const audioQuality = document.getElementById('audio-quality');
  const videoQuality = document.getElementById('video-quality');

  const processBtn = document.getElementById('process-btn');
  const progressWrap = document.getElementById('progress-wrap');
  const progressBar = document.getElementById('progress-bar');
  const progressPercent = document.getElementById('progress-percent');
  const progressMessage = document.getElementById('progress-message');

  let currentType = 'audio';
  let currentDuration = 0;
  let eventSource = null;

  /**
   * fetch envuelto a prueba de fallos: nunca deja que un body vacío, no-JSON
   * o un error de red termine en una excepción sin manejar en el llamador.
   * Siempre resuelve con los datos o lanza un Error con mensaje amigable.
   */
  async function fetchJson(url, options) {
    let response;
    try {
      response = await fetch(url, options);
    } catch {
      throw new Error('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.');
    }

    const contentType = response.headers.get('content-type') || '';
    let data = null;

    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      throw new Error((data && data.error) || `El servidor respondió con un error (${response.status}).`);
    }

    if (!data) {
      throw new Error('El servidor no devolvió una respuesta válida. Intenta nuevamente en unos segundos.');
    }

    if (data.success === false) {
      throw new Error(data.error || 'Ocurrió un error inesperado.');
    }

    return data;
  }

  function showError(message) {
    errorBanner.textContent = message;
    errorBanner.classList.remove('hidden');
  }

  function clearError() {
    errorBanner.classList.add('hidden');
    errorBanner.textContent = '';
  }

  function formatDuration(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function setAnalyzing(isLoading) {
    analyzeBtn.disabled = isLoading;
    analyzeSpinner.classList.toggle('hidden', !isLoading);
    analyzeBtnLabel.textContent = isLoading ? 'Analizando...' : 'Analizar';
  }

  function switchTab(type) {
    currentType = type;
    tabButtons.forEach((btn) => {
      btn.classList.toggle('tab-btn-active', btn.dataset.tab === type);
    });
    audioPanel.classList.toggle('hidden', type !== 'audio');
    videoPanel.classList.toggle('hidden', type !== 'video');
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  analyzeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const url = urlInput.value.trim();
    if (!url) {
      showError('Ingresa un enlace de YouTube.');
      return;
    }

    setAnalyzing(true);
    videoCard.classList.add('hidden');

    try {
      const data = await fetchJson('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      currentDuration = data.duration || 0;
      videoTitle.textContent = data.title || 'Video sin título';
      videoMeta.textContent = [data.uploader, formatDuration(currentDuration)].filter(Boolean).join(' · ');
      videoPlayer.src = `https://www.youtube.com/embed/${data.id}`;

      startMin.value = 0;
      startSec.value = 0;
      endMin.value = 0;
      endSec.value = 0;

      resetProgress();
      videoCard.classList.remove('hidden');
      videoCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      showError(err.message || 'No se pudo analizar el video.');
    } finally {
      setAnalyzing(false);
    }
  });

  function resetProgress() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    progressWrap.classList.add('hidden');
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    processBtn.disabled = false;
    processBtn.textContent = 'Procesar y descargar';
  }

  function secondsFrom(minInput, secInput) {
    const m = Math.max(0, parseInt(minInput.value, 10) || 0);
    const s = Math.max(0, Math.min(59, parseInt(secInput.value, 10) || 0));
    return m * 60 + s;
  }

  processBtn.addEventListener('click', async () => {
    clearError();

    const url = urlInput.value.trim();
    const start = secondsFrom(startMin, startSec);
    const end = secondsFrom(endMin, endSec);

    if (end > 0 && start >= end) {
      showError('El tiempo de inicio debe ser menor al tiempo final.');
      return;
    }
    if (currentDuration && end > currentDuration) {
      showError('El tiempo final no puede superar la duración del video.');
      return;
    }

    const quality = currentType === 'audio' ? audioQuality.value : videoQuality.value;

    processBtn.disabled = true;
    processBtn.textContent = 'Procesando...';
    progressWrap.classList.remove('hidden');
    progressBar.style.width = '2%';
    progressPercent.textContent = '0%';
    progressMessage.textContent = 'Enviando solicitud...';

    try {
      const data = await fetchJson('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type: currentType, quality, start, end }),
      });

      trackJob(data.jobId);
    } catch (err) {
      showError(err.message || 'No se pudo iniciar el procesamiento.');
      resetProgress();
    }
  });

  function trackJob(jobId) {
    eventSource = new EventSource(`/api/jobs/${jobId}/events`);

    eventSource.onmessage = (event) => {
      let job;
      try {
        job = JSON.parse(event.data);
      } catch {
        return;
      }
      const pct = Math.round(job.progress || 0);

      progressBar.style.width = `${pct}%`;
      progressPercent.textContent = `${pct}%`;
      progressMessage.textContent = job.message || '';

      if (job.status === 'done') {
        progressMessage.textContent = '¡Listo! Iniciando descarga...';
        eventSource.close();
        eventSource = null;

        const link = document.createElement('a');
        link.href = `/api/jobs/${jobId}/file`;
        link.download = job.fileName || 'descargaya';
        document.body.appendChild(link);
        link.click();
        link.remove();

        processBtn.disabled = false;
        processBtn.textContent = 'Procesar y descargar';
      }

      if (job.status === 'error') {
        eventSource.close();
        eventSource = null;
        showError(job.error || 'Ocurrió un error al procesar el video.');
        resetProgress();
      }
    };

    eventSource.onerror = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      showError('Se perdió la conexión con el servidor durante el procesamiento.');
      resetProgress();
    };
  }
})();
