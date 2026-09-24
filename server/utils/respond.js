function ok(res, data = {}, status = 200) {
  res.status(status).json({ success: true, ...data });
}

function fail(res, message, status = 400) {
  res.status(status).json({ success: false, error: message || 'Ocurrió un error inesperado.' });
}

module.exports = { ok, fail };
