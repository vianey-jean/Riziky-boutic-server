
const notFoundHandler = (req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
};

const globalErrorHandler = (err, req, res, next) => {
  console.error('Erreur serveur:', err);
  
  // Ne pas exposer les détails de l'erreur en production
  const isDev = process.env.NODE_ENV === 'development';
  const message = isDev ? err.message : 'Une erreur est survenue';
  
  res.status(500).json({
    message,
    error: isDev ? err.stack : {}
  });
};

module.exports = {
  notFoundHandler,
  globalErrorHandler
};
