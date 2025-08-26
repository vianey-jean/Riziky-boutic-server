
const socketIO = require('socket.io');
const socketAuth = require('./socketAuth');
const {
  handleAuthentication,
  handleVideoCallEvents,
  handleChatEvents,
  handleOrderEvents,
  handleStockEvents,
  handleUtilityEvents,
  handleDisconnection
} = require('./socketHandlers');

const initializeSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    allowEIO3: true
  });

  // Authentification plus souple pour Socket.io
  io.use(socketAuth);

  // Gestion des connexions socket
  io.on('connection', (socket) => {
    console.log('Nouvelle connexion socket:', socket.id);

    // Configurer tous les gestionnaires d'événements
    handleAuthentication(socket, io);
    handleVideoCallEvents(socket, io);
    handleChatEvents(socket, io);
    handleOrderEvents(socket, io);
    handleStockEvents(socket, io);
    handleUtilityEvents(socket, io);
    handleDisconnection(socket, io);
  });

  return io;
};

module.exports = initializeSocket;
