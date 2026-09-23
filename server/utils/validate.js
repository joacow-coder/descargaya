const YOUTUBE_URL_REGEX =
  /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{6,}/i;

function isValidYouTubeUrl(url) {
  return typeof url === 'string' && YOUTUBE_URL_REGEX.test(url.trim());
}

function toSeconds(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function sanitizeQuality(type, quality) {
  const audioQualities = ['128', '192', '320'];
  const videoQualities = ['720', '1080'];
  const q = String(quality);
  if (type === 'audio') return audioQualities.includes(q) ? q : '192';
  if (type === 'video') return videoQualities.includes(q) ? q : '720';
  return null;
}

module.exports = { isValidYouTubeUrl, toSeconds, sanitizeQuality };
