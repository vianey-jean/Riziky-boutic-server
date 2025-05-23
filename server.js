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
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' } // Activer le partage de ressources cross-origin
})); // Headers de sécurité
app.use(xssClean()); // Protéger contre les attaques XSS

// Configuration de CORS avec options avancées
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:8080', 
      'http://localhost:5173',
      'http://localhost:3000',
      'https://riziky-boutic.vercel.app',
      'https://riziky-boutic.onrender.com',
      'https://riziky-boutic-server.onrender.com'
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

// Middleware additionnels pour les en-têtes CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'credentialless');
  res.header('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

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

// Middleware pour servir les fichiers statiques avec des en-têtes CORS appropriés
app.use('/uploads', (req, res, next) => {
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  express.static(path.join(__dirname, 'uploads'))(req, res, next);
});

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
const codePromoRoutes = require('./routes/code-promos');

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
app.use('/api/code-promos', codePromoRoutes);

// Socket.io pour la communication en temps réel
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  allowEIO3: true // Enabling older protocol version for compatibility
});

// Authentification plus souple pour Socket.io
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      // Permettre des connexions anonymes pour certaines fonctionnalités
      socket.user = { id: 'anonymous', role: 'guest' };
      return next();
    }
    
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      socket.user = user;
      next();
    } catch (err) {
      console.log("Token invalide pour socket, permettant en tant qu'invité:", err.message);
      socket.user = { id: 'anonymous', role: 'guest' };
      next();
    }
  } catch (e) {
    console.log("Erreur d'authentification socket, permettant en tant qu'invité:", e);
    socket.user = { id: 'anonymous', role: 'guest' };
    next();
  }
});

// Variables pour suivre les connexions actives et les appels
const activeUsers = new Map();
const activeCallsMap = new Map();

// Gestion des connexions socket
io.on('connection', (socket) => {
  console.log('Nouvelle connexion socket:', socket.id);

  // Authentifier et stocker l'utilisateur
  socket.on('authenticate', (userData) => {
    if (userData && userData.id) {
      socket.user = userData;
      socket.join(`user-${userData.id}`);
      console.log(`L'utilisateur ${userData.id} a rejoint sa salle privée`);
      
      // Stocker la connexion active
      activeUsers.set(userData.id, {
        socketId: socket.id,
        userId: userData.id,
        username: userData.name || userData.email,
        role: userData.role
      });

      // Si c'est un admin, rejoindre la salle admin
      if (userData.role === 'admin') {
        socket.join('admins');
        console.log(`Admin ${userData.id} a rejoint la salle des admins`);
      }
      
      // Envoyer confirmation d'authentification
      socket.emit('authenticated', { status: 'success', userId: userData.id });
    }
  });

  // Événements pour les appels vidéo/audio
  socket.on('callUser', (data) => {
    try {
      const { userToCall, signal, isVideo } = data;
      const caller = socket.user;
      
      console.log(`Appel de ${caller.id} vers ${userToCall} (${isVideo ? 'vidéo' : 'audio'})`);
      
      // Vérifier si l'utilisateur appelé est en ligne
      const targetUser = activeUsers.get(userToCall);
      
      if (!targetUser) {
        socket.emit('callFailed', { reason: 'user-offline' });
        return;
      }
      
      // Enregistrer l'appel actif
      activeCallsMap.set(userToCall, {
        caller: caller.id,
        signal,
        isVideo,
        timestamp: Date.now()
      });
      
      // Envoyer la notification d'appel au destinataire
      io.to(`user-${userToCall}`).emit('callIncoming', {
        from: caller.id,
        name: caller.name || caller.email || 'Utilisateur',
        signal,
        isVideo
      });
    } catch (error) {
      console.error('Erreur lors de l\'initiation de l\'appel:', error);
      socket.emit('callFailed', { reason: 'server-error' });
    }
  });
  
  socket.on('acceptCall', (data) => {
    try {
      const { to, signal } = data;
      console.log(`Appel accepté par ${socket.user.id} pour l'utilisateur ${to}`);
      io.to(`user-${to}`).emit('callAccepted', signal);
    } catch (error) {
      console.error('Erreur lors de l\'acceptation de l\'appel:', error);
    }
  });
  
  socket.on('rejectCall', (data) => {
    try {
      const { to } = data;
      console.log(`Appel rejeté par ${socket.user.id} pour l'utilisateur ${to}`);
      
      // Supprimer l'appel actif
      if (activeCallsMap.has(socket.user.id)) {
        activeCallsMap.delete(socket.user.id);
      }
      
      io.to(`user-${to}`).emit('callRejected');
    } catch (error) {
      console.error('Erreur lors du rejet de l\'appel:', error);
    }
  });
  
  socket.on('endCall', (data) => {
    try {
      const { to } = data;
      console.log(`Appel terminé par ${socket.user.id} avec l'utilisateur ${to}`);
      
      // Supprimer l'appel actif
      if (activeCallsMap.has(socket.user.id)) {
        activeCallsMap.delete(socket.user.id);
      }
      
      if (activeCallsMap.has(to)) {
        activeCallsMap.delete(to);
      }
      
      io.to(`user-${to}`).emit('callEnded');
    } catch (error) {
      console.error('Erreur lors de la fin de l\'appel:', error);
    }
  });
  
  socket.on('sendSignalResponse', (data) => {
    try {
      const { to, signal } = data;
      io.to(`user-${to}`).emit('peerSignal', signal);
    } catch (error) {
      console.error('Erreur lors de l\'envoi du signal:', error);
    }
  });
  
  socket.on('getCallerSignal', (data) => {
    try {
      const { from } = data;
      
      // Récupérer le signal de l'appelant
      if (activeCallsMap.has(socket.user.id)) {
        const callData = activeCallsMap.get(socket.user.id);
        socket.emit('peerSignal', callData.signal);
      } else {
        // Si pas de signal, demander à l'appelant de le renvoyer
        io.to(`user-${from}`).emit('sendSignalRequest', { to: socket.user.id });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du signal:', error);
    }
  });

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

  // Ping/Pong pour garder la connexion active
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // Gestion de la déconnexion
  socket.on('disconnect', () => {
    console.log('Déconnexion socket:', socket.id);
    
    // Supprimer l'utilisateur de la liste des utilisateurs actifs
    if (socket.user && socket.user.id !== 'anonymous') {
      activeUsers.delete(socket.user.id);
      
      // Annuler tous les appels actifs impliquant cet utilisateur
      activeCallsMap.forEach((callData, userId) => {
        if (callData.caller === socket.user.id) {
          io.to(`user-${userId}`).emit('callEnded');
          activeCallsMap.delete(userId);
        }
      });
      
      if (activeCallsMap.has(socket.user.id)) {
        const callData = activeCallsMap.get(socket.user.id);
        io.to(`user-${callData.caller}`).emit('callEnded');
        activeCallsMap.delete(socket.user.id);
      }
    }
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
