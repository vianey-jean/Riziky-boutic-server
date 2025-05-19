
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const socketIO = require('socket.io');
const xssClean = require('xss-clean');
const { createServer } = require('http');

// Initialiser l'application Express
const app = express();
const server = createServer(app);

// Middleware de sécurité
app.use(helmet({ contentSecurityPolicy: false })); // Headers de sécurité
app.use(xssClean()); // Protéger contre les attaques XSS

// Configuration de CORS avec options avancées
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:8080', 
      'http://localhost:5173', 
      'https://riziky-boutic.onrender.com'
    ];
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`Origine rejetée: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-Request-Id']
};

app.use(cors(corsOptions));

// Middleware pour parser le corps des requêtes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware pour vérifier et créer les fichiers de données s'ils n'existent pas
app.use((req, res, next) => {
  const dataFiles = [
    'users.json',
    'products.json',
    'panier.json',
    'favorites.json',
    'orders.json',
    'contacts.json',
    'client-chat.json',
    'admin-chat.json',
    'preferences.json',
    'reviews.json',
    'reset-codes.json',
  ];

  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  dataFiles.forEach(file => {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([]));
    }
  });

  next();
});

// Middleware pour servir les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware d'authentification global
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentification requise' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token invalide ou expiré' });
    }
    req.user = user;
    next();
  });
};

// Protection contre les injections
app.use((req, res, next) => {
  // Vérifier et nettoyer les paramètres de la requête
  if (req.params) {
    const keys = Object.keys(req.params);
    for (let key of keys) {
      req.params[key] = req.params[key]
        .replace(/[<>]/g, '') // Supprimer les balises HTML
        .trim();
    }
  }
  
  // Vérifier et nettoyer le corps de la requête
  if (req.body && typeof req.body === 'object') {
    const sanitize = (obj) => {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          sanitized[key] = value
            .replace(/[<>]/g, '') // Supprimer les balises HTML
            .trim();
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    // Ne pas sanitizer les fichiers ou données binaires
    if (!req.is('multipart/form-data')) {
      req.body = sanitize(req.body);
    }
  }

  next();
});

// Routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const panierRoutes = require('./routes/panier');
const favoriteRoutes = require('./routes/favorites');
const orderRoutes = require('./routes/orders');
const contactRoutes = require('./routes/contacts');
const clientChatRoutes = require('./routes/client-chat');
const adminChatRoutes = require('./routes/admin-chat');
const usersRoutes = require('./routes/users');
const reviewRoutes = require('./routes/reviews');

// Routes de l'API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/panier', panierRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/client-chat', clientChatRoutes);
app.use('/api/admin-chat', adminChatRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reviews', reviewRoutes);

// Socket.io pour la communication en temps réel
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Authentification par socket pour les clients
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentification requise'));
  }
  
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Token invalide ou expiré'));
  }
});

// Gestion des connexions socket
io.on('connection', (socket) => {
  console.log('Nouvelle connexion socket:', socket.id);

  // Stocker l'ID socket de l'utilisateur
  if (socket.user) {
    // Rejoindre la salle utilisateur
    socket.join(`user-${socket.user.id}`);
    console.log(`L'utilisateur ${socket.user.id} a rejoint sa salle privée`);

    // Si c'est un admin, rejoindre la salle admin
    if (socket.user.role === 'admin') {
      socket.join('admins');
      console.log(`Admin ${socket.user.id} a rejoint la salle des admins`);
    }
  }

  // Gestion des messages de chat client
  socket.on('client-message', (data) => {
    io.to('admins').emit('new-client-message', {
      ...data,
      senderId: socket.user.id,
      senderName: socket.user.name || socket.user.email
    });
  });

  // Gestion des messages de chat admin
  socket.on('admin-message', (data) => {
    io.to(`user-${data.userId}`).emit('new-admin-message', {
      ...data,
      senderId: socket.user.id,
      senderName: socket.user.name || socket.user.email
    });
  });

  // Notification pour nouvel ordre
  socket.on('new-order', (data) => {
    io.to('admins').emit('order-notification', {
      ...data,
      userId: socket.user.id,
      userName: socket.user.name || socket.user.email
    });
  });

  // Gestion de la déconnexion
  socket.on('disconnect', () => {
    console.log('Déconnexion socket:', socket.id);
  });
});

// Route pour tester le serveur
app.get('/', (req, res) => {
  res.send('API de l\'application e-commerce Riziky-Boutic est active!');
});

// Middleware pour la gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

// Middleware pour la gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  
  // Ne pas exposer les détails de l'erreur en production
  const isDev = process.env.NODE_ENV === 'development';
  const message = isDev ? err.message : 'Une erreur est survenue';
  
  res.status(500).json({
    message,
    error: isDev ? err.stack : {}
  });
});

// Démarrer le serveur
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
