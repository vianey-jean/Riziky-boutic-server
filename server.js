
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { createServer } = require('http');

// Importation des modules de configuration
const corsOptions = require('./config/cors');
const { securityMiddlewares, additionalCorsHeaders, sanitizeMiddleware } = require('./config/security');
const { initializeDataFiles } = require('./config/dataFiles');
const { authenticateToken } = require('./config/auth');
const setupRoutes = require('./config/routes');
const { notFoundHandler, globalErrorHandler } = require('./config/errorHandlers');
const initializeSocket = require('./socket/socketConfig');

// Initialiser l'application Express
const app = express();
const server = createServer(app);

// Middleware de sécurité
securityMiddlewares.forEach(middleware => app.use(middleware));

// Configuration de CORS
app.use(cors(corsOptions));

// Middleware additionnels pour les en-têtes CORS
app.use(additionalCorsHeaders);

// Middleware pour parser le corps des requêtes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware pour vérifier et créer les fichiers de données s'ils n'existent pas
app.use(initializeDataFiles);

// Middleware pour servir les fichiers statiques avec des en-têtes CORS appropriés
app.use('/uploads', (req, res, next) => {
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  express.static(path.join(__dirname, 'uploads'))(req, res, next);
});

// Protection contre les injections
app.use(sanitizeMiddleware);

// Configuration des routes
setupRoutes(app);

// Initialiser Socket.io
const io = initializeSocket(server);

// Route pour tester le serveur
app.get('/', (req, res) => {
  res.send('API de l\'application e-commerce Riziky-Boutic est active!');
});

// Middleware pour la gestion des erreurs
app.use(notFoundHandler);
app.use(globalErrorHandler);

// Démarrer le serveur
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
