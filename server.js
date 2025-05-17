
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');

// Création du serveur Express
const app = express();
const PORT = process.env.PORT || 10000;

// Création du serveur HTTP
const server = http.createServer(app);

// Configuration de Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Middleware pour le CORS
app.use(cors());

// Middleware pour parser le JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/panier', require('./routes/panier'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin-chat', require('./routes/admin-chat'));
app.use('/api/client-chat', require('./routes/client-chat'));
app.use('/api/reviews', require('./routes/reviews')); // Nouvelle route pour les commentaires

// Configuration de Socket.IO pour les chats
const adminChatNamespace = io.of('/admin-chat');
const clientChatNamespace = io.of('/client-chat');

// Gestion des connexions pour le chat admin
adminChatNamespace.on('connection', (socket) => {
  console.log('Un administrateur s\'est connecté au chat admin');
  
  // Rejoindre une salle spécifique pour les communications privées
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Admin a rejoint la salle: ${room}`);
  });
  
  // Écouter les messages
  socket.on('send-message', (data) => {
    console.log('Message reçu dans le chat admin:', data);
    // Émettre le message à tous les clients dans la salle spécifiée
    adminChatNamespace.to(data.room).emit('receive-message', data);
  });
  
  // Écouter les déconnexions
  socket.on('disconnect', () => {
    console.log('Un administrateur s\'est déconnecté du chat admin');
  });
});

// Gestion des connexions pour le chat client
clientChatNamespace.on('connection', (socket) => {
  console.log('Un client s\'est connecté au chat client');
  
  // Rejoindre une salle spécifique pour les communications privées
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Client a rejoint la salle: ${room}`);
  });
  
  // Écouter les messages
  socket.on('send-message', (data) => {
    console.log('Message reçu dans le chat client:', data);
    // Émettre le message à tous les clients dans la salle spécifiée
    clientChatNamespace.to(data.room).emit('receive-message', data);
  });
  
  // Écouter les déconnexions
  socket.on('disconnect', () => {
    console.log('Un client s\'est déconnecté du chat client');
  });
});

// Route par défaut
app.get('/', (req, res) => {
  res.json({ message: 'API du serveur Riziky-Agendas est opérationnelle' });
});

// Démarrer le serveur
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
