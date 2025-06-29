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
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/panier', require('./routes/panier'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/flash-sales', require('./routes/flash-sales'));
app.use('/api/code-promos', require('./routes/code-promos'));
app.use('/api/remboursements', require('./routes/remboursements'));
app.use('/api/sales-notifications', require('./routes/sales-notifications'));
app.use('/api/visitors', require('./routes/visitors'));
app.use('/api/pub-layout', require('./routes/pub-layout'));
app.use('/api/site-settings', require('./routes/site-settings'));
app.use('/api/data-sync', require('./routes/data-sync'));
app.use('/api/admin-chat', require('./routes/admin-chat'));
app.use('/api/client-chat', require('./routes/client-chat'));
app.use('/api/cards', require('./routes/cards'));

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
