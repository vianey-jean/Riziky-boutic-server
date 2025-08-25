
const helmet = require('helmet');
const xssClean = require('xss-clean');

const securityMiddlewares = [
  helmet({ 
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "https:", "wss:", "ws:"],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "data:", "blob:", "mediastream:", "https:"],
        workerSrc: ["'self'", "blob:"]
      }
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }),
  xssClean()
];

const additionalCorsHeaders = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'credentialless');
  res.header('Cross-Origin-Opener-Policy', 'same-origin');
  next();
};

const sanitizeMiddleware = (req, res, next) => {
  // Vérifier et nettoyer les paramètres de la requête
  if (req.params) {
    const keys = Object.keys(req.params);
    for (let key of keys) {
      req.params[key] = req.params[key]
        .replace(/[<>]/g, '')
        .trim();
    }
  }
  
  if (req.body && typeof req.body === 'object') {
    const sanitize = (obj) => {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          sanitized[key] = value
            .replace(/[<>]/g, '')
            .trim();
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    if (!req.is('multipart/form-data')) {
      req.body = sanitize(req.body);
    }
  }

  next();
};

module.exports = {
  securityMiddlewares,
  additionalCorsHeaders,
  sanitizeMiddleware
};
