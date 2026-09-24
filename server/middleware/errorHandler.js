module.exports = function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ success: false, error: 'Ocurrió un error interno en el servidor.' });
};
