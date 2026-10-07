export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error.status || (error.name === "ZodError" ? 400 : 500);
  res.status(status).json({
    success: false,
    message: error.message || "Neocekivana greska"
  });
}
