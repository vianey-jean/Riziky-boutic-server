
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
      origin: function (origin, callback) {
        const allowedOrigins = [
          'http://localhost:8080', 
          'http://localhost:5173',
          'http://localhost:3000',
          'https://riziky-boutic.vercel.app',
          'https://riziky-boutic.onrender.com',
          'https://riziky-boutic-server.onrender.com',
          'https://d18de9e1-f502-4cb4-bec0-327000f66a2d.lovableproject.com',
          'https://id-preview--d18de9e1-f502-4cb4-bec0-327000f66a2d.lovable.app',
          'https://b4bea8fe-de4c-46cf-bc64-943e6e52345e.sandbox.lovable.dev'
        ];
        
        if (!origin || 
            allowedOrigins.indexOf(origin) !== -1 || 
            origin.includes('lovable.app') || 
            origin.includes('lovableproject.com') ||
            origin.includes('sandbox.lovable.dev')) {
          callback(null, true);
        } else {
          console.log(`Socket origine rejetée: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
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
