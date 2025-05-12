
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const PORT = process.env.PORT || 10000;

// Création du serveur HTTP
const server = http.createServer(app);

// Configuration de CORS
const corsOptions = {
  origin: '*', // En production, spécifiez les origines exactes
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialisation de Socket.io avec les mêmes options CORS
const io = socketIo(server, {
  cors: corsOptions,
  pingTimeout: 60000, // Délai après lequel Socket.io considère une connexion comme inactive
});

// Configuration pour les uploads d'images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Création du dossier uploads s'il n'existe pas
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Création des fichiers JSON s'ils n'existent pas
const dataFiles = [
  'users.json', 
  'products.json', 
  'panier.json', 
  'favorites.json', 
  'contacts.json',
  'commandes.json',
  'admin-chat.json',
  'client-chat.json'
];

dataFiles.forEach(file => {
  const filePath = path.join(__dirname, 'data', file);
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    const initialData = file === 'admin-chat.json' || file === 'client-chat.json' 
      ? { conversations: {}, onlineUsers: {}, autoReplySent: {} } 
      : [];
    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
  }
});

// Stocker les connexions des utilisateurs
const connectedUsers = {};

// Gestion des événements Socket.io
io.on('connection', (socket) => {
  console.log('Nouvelle connexion Socket.io:', socket.id);

  // Authentification de l'utilisateur
  socket.on('authenticate', (userData) => {
    if (userData && userData.id) {
      console.log(`Utilisateur authentifié: ${userData.id}`);
      
      // Associer l'ID utilisateur au socket
      socket.userId = userData.id;
      connectedUsers[userData.id] = socket.id;
      
      // Informer les autres de la connexion
      socket.broadcast.emit('userStatusChange', { 
        userId: userData.id, 
        isOnline: true 
      });
    }
  });

  // Gestion des appels
  socket.on('callUser', (data) => {
    const { userToCall, signal, isVideo } = data;
    const from = socket.userId;
    
    console.log(`Appel de ${from} vers ${userToCall} (${isVideo ? 'vidéo' : 'audio'})`);

    // Vérifier si le destinataire est connecté
    if (connectedUsers[userToCall]) {
      // Récupérer les informations de l'utilisateur appelant
      const usersFilePath = path.join(__dirname, 'data', 'users.json');
      const users = JSON.parse(fs.readFileSync(usersFilePath));
      const caller = users.find(user => user.id === from);
      
      if (caller) {
        // Transmettre l'appel au destinataire
        io.to(connectedUsers[userToCall]).emit('callIncoming', {
          from: from,
          name: caller.nom || "Utilisateur",
          isVideo: isVideo,
          signal: signal
        });
        
        console.log(`Notification d'appel envoyée à ${userToCall}`);
      }
    } else {
      console.log(`Utilisateur ${userToCall} non connecté`);
      socket.emit('callFailed', { reason: 'user-offline' });
    }
  });

  // Acceptation d'un appel
  socket.on('acceptCall', (data) => {
    const { to, signal } = data;
    console.log(`Appel accepté par ${socket.userId} pour ${to}`);
    
    if (connectedUsers[to]) {
      io.to(connectedUsers[to]).emit('callAccepted', signal);
    }
  });

  // Récupération du signal de l'appelant
  socket.on('getCallerSignal', (data) => {
    const { from } = data;
    console.log(`Demande de signal pour l'appelant ${from}`);
    
    if (connectedUsers[from] && socket.userId) {
      io.to(connectedUsers[from]).emit('sendSignalRequest', { 
        to: socket.userId 
      });
    }
  });

  // Réception du signal pour l'appelant
  socket.on('sendSignalResponse', (data) => {
    const { to, signal } = data;
    console.log(`Envoi du signal à ${to}`);
    
    if (connectedUsers[to]) {
      io.to(connectedUsers[to]).emit('peerSignal', signal);
    }
  });

  // Rejet d'un appel
  socket.on('rejectCall', (data) => {
    const { to } = data;
    console.log(`Appel rejeté par ${socket.userId} pour ${to}`);
    
    if (connectedUsers[to]) {
      io.to(connectedUsers[to]).emit('callRejected');
    }
  });

  // Fin d'un appel
  socket.on('endCall', (data) => {
    const { to } = data;
    console.log(`Appel terminé par ${socket.userId} pour ${to}`);
    
    if (to && connectedUsers[to]) {
      io.to(connectedUsers[to]).emit('callEnded');
    }
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log('Déconnexion Socket.io:', socket.id);
    
    if (socket.userId) {
      // Supprimer le mapping utilisateur-socket
      delete connectedUsers[socket.userId];
      
      // Informer les autres de la déconnexion
      socket.broadcast.emit('userStatusChange', { 
        userId: socket.userId, 
        isOnline: false 
      });
      
      console.log(`Utilisateur déconnecté: ${socket.userId}`);
    }
  });
});

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/panier', require('./routes/panier'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin-chat', require('./routes/admin-chat'));
app.use('/api/client-chat', require('./routes/client-chat'));

// Route pour les images uploadées
app.use('/uploads', express.static('uploads'));

// Route pour les sons
app.use('/sounds', express.static(path.join(__dirname, '..', 'public', 'sounds')));

// Démarrage du serveur
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
