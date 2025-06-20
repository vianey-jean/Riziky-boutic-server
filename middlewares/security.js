
/**
 * MIDDLEWARE DE SÉCURITÉ AVANCÉ - Riziky-Boutic
 * 
 * Ce fichier contient tous les middlewares de sécurité pour protéger l'API backend
 * contre les attaques malveillantes, les injections et les accès non autorisés.
 * 
 * Fonctionnalités principales:
 * - Rate limiting différencié par type de requête
 * - Validation et sanitisation des entrées utilisateur
 * - Headers de sécurité avec Helmet
 * - Détection d'activité suspecte
 * - Logging de sécurité pour monitoring
 */

const helmet = require('helmet');
const xssClean = require('xss-clean');
const rateLimit = require('express-rate-limit');

// ==========================================
// CONFIGURATION DES RATE LIMITS
// ==========================================

/**
 * Crée un rate limiter personnalisé avec configuration spécifique
 * @param {number} windowMs - Fenêtre de temps en millisecondes
 * @param {number} max - Nombre maximum de requêtes autorisées
 * @param {string} message - Message d'erreur à retourner
 * @returns {Function} Middleware rate limiter configuré
 */
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true, // Inclut les headers standard de rate limiting
  legacyHeaders: false,  // Désactive les anciens headers
  handler: (req, res) => {
    // Log de sécurité pour détection d'abus
    console.log(`🚨 Rate limit dépassé pour IP: ${req.ip}, URL: ${req.originalUrl}`);
    res.status(429).json({ 
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    });
  }
});

// Rate limiters spécialisés par type d'utilisation
const generalLimiter = createRateLimit(15 * 60 * 1000, 100, 'Trop de requêtes générales, réessayez plus tard');
const authLimiter = createRateLimit(15 * 60 * 1000, 5, 'Trop de tentatives de connexion');
const apiLimiter = createRateLimit(15 * 60 * 1000, 200, 'Limite API atteinte');

// ==========================================
// MIDDLEWARES DE SÉCURITÉ HELMET
// ==========================================

/**
 * Configuration des middlewares de sécurité avec Helmet
 * Protège contre les vulnérabilités web communes (XSS, clickjacking, etc.)
 */
const securityMiddlewares = [
  helmet({ 
    // Configuration CSP (Content Security Policy)
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    // Configuration CORS pour les ressources cross-origin
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Configuration HSTS (HTTP Strict Transport Security)
    hsts: {
      maxAge: 31536000,      // 1 an en secondes
      includeSubDomains: true,
      preload: true
    }
  }),
  // Protection XSS automatique
  xssClean()
];

// ==========================================
// CONFIGURATION CORS AVANCÉE
// ==========================================

/**
 * Middleware pour headers CORS additionnels et sécurisés
 * Gère les requêtes cross-origin de manière sécurisée
 */
const additionalCorsHeaders = (req, res, next) => {
  // Configuration dynamique de l'origine autorisée
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Headers de sécurité cross-origin
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'credentialless');
  res.header('Cross-Origin-Opener-Policy', 'same-origin');
  
  // Gestion des requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
};

// ==========================================
// VALIDATION ET SANITISATION DES ENTRÉES
// ==========================================

/**
 * Valide un input selon des critères spécifiques
 * @param {*} input - Données à valider
 * @param {string} type - Type attendu ('string', 'number', etc.)
 * @param {number} maxLength - Longueur maximale pour les chaînes
 * @returns {boolean} True si valide, false sinon
 */
const validateInput = (input, type = 'string', maxLength = 1000) => {
  if (typeof input !== type) return false;
  if (type === 'string' && input.length > maxLength) return false;
  if (type === 'string' && /<script|javascript:|data:/i.test(input)) return false;
  return true;
};

/**
 * Middleware de sanitisation avancée des données entrantes
 * Nettoie et valide tous les paramètres, query params et body
 */
const sanitizeMiddleware = (req, res, next) => {
  try {
    // ==========================================
    // NETTOYAGE DES PARAMÈTRES D'URL
    // ==========================================
    if (req.params) {
      const keys = Object.keys(req.params);
      for (let key of keys) {
        // Validation sécurisée de chaque paramètre
        if (!validateInput(req.params[key], 'string', 200)) {
          return res.status(400).json({ error: 'Paramètres d\'URL invalides' });
        }
        
        // Nettoyage et limitation de longueur
        req.params[key] = req.params[key]
          .replace(/[<>]/g, '')              // Supprime les balises HTML
          .trim()                           // Supprime les espaces
          .substring(0, 200);               // Limite la longueur
      }
    }
    
    // ==========================================
    // NETTOYAGE DES QUERY PARAMETERS
    // ==========================================
    if (req.query) {
      const keys = Object.keys(req.query);
      for (let key of keys) {
        if (typeof req.query[key] === 'string') {
          // Validation des query params
          if (!validateInput(req.query[key], 'string', 500)) {
            return res.status(400).json({ error: 'Paramètres de requête invalides' });
          }
          
          // Sanitisation des query params
          req.query[key] = req.query[key]
            .replace(/[<>]/g, '')
            .trim()
            .substring(0, 500);
        }
      }
    }
    
    // ==========================================
    // NETTOYAGE RÉCURSIF DU BODY
    // ==========================================
    if (req.body && typeof req.body === 'object' && !req.is('multipart/form-data')) {
      /**
       * Fonction récursive pour nettoyer les objets imbriqués
       * @param {Object} obj - Objet à nettoyer
       * @param {number} depth - Profondeur actuelle (protection contre récursion infinie)
       * @returns {Object} Objet nettoyé
       */
      const sanitizeObject = (obj, depth = 0) => {
        // Protection contre la récursion infinie
        if (depth > 10) return obj;
        
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string') {
            // Validation et nettoyage des chaînes
            if (!validateInput(value, 'string', 10000)) {
              throw new Error('Contenu invalide détecté dans le body');
            }
            sanitized[key] = value
              .replace(/[<>]/g, '')
              .trim()
              .substring(0, 10000);
          } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Nettoyage récursif des objets imbriqués
            sanitized[key] = sanitizeObject(value, depth + 1);
          } else if (Array.isArray(value)) {
            // Nettoyage des tableaux
            sanitized[key] = value.map(item => 
              typeof item === 'string' ? 
                item.replace(/[<>]/g, '').trim().substring(0, 1000) : 
                item
            );
          } else {
            // Conservation des autres types de données
            sanitized[key] = value;
          }
        }
        return sanitized;
      };

      // Application du nettoyage récursif
      req.body = sanitizeObject(req.body);
    }

    next();
  } catch (error) {
    // Gestion des erreurs de validation
    console.error('🚨 Erreur de validation des données:', error.message);
    res.status(400).json({ error: 'Données invalides détectées' });
  }
};

// ==========================================
// DÉTECTION D'ACTIVITÉ SUSPECTE
// ==========================================

/**
 * Middleware de logging et détection d'activité suspecte
 * Analyse les patterns malveillants dans les requêtes
 */
const securityLogger = (req, res, next) => {
  // Patterns suspects à détecter
  const suspiciousPatterns = [
    /(<script|javascript:|data:)/i,                    // Tentatives XSS
    /(union|select|insert|delete|drop|create|alter)/i, // Tentatives SQL injection
    /(\.\.|\/\/|\\\\)/,                               // Directory traversal
    /(eval\(|function\(|=>)/                          // Code injection JavaScript
  ];

  // Sérialisation des données de la requête pour analyse
  const requestData = JSON.stringify({
    params: req.params,
    query: req.query,
    body: req.body
  });

  // Détection de patterns suspects
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(requestData));
  
  if (isSuspicious) {
    // Log détaillé de l'activité suspecte
    console.warn(`🚨 ALERTE SÉCURITÉ - Activité suspecte détectée:`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
      suspiciousData: requestData
    });
    
    // Optionnel: Bloquer la requête suspecte
    // return res.status(403).json({ error: 'Requête bloquée pour raisons de sécurité' });
  }

  next();
};

// ==========================================
// EXPORTS DES MIDDLEWARES
// ==========================================

module.exports = {
  // Middlewares de sécurité Helmet
  securityMiddlewares,
  
  // Configuration CORS
  additionalCorsHeaders,
  
  // Validation et sanitisation
  sanitizeMiddleware,
  
  // Rate limiters spécialisés
  generalLimiter,    // Pour les requêtes générales
  authLimiter,       // Pour l'authentification
  apiLimiter,        // Pour les appels API intensifs
  
  // Détection de sécurité
  securityLogger
};
