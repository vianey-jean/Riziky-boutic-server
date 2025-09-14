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
          'https://riziky-boutic.netlify.app',
          'https://riziky-boutic.onrender.com',
          'https://riziky-boutic-server.onrender.com'
        ];

        // Autorise les requêtes sans origin (ex: curl/Postman) et les origines listées
        if (!origin || allowedOrigins.includes(origin)) {
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

  // Middleware d'authentification pour socket.io
  io.use(socketAuth);

  // Gestion des connexions socket
  io.on('connection', (socket) => {
    console.log('Nouvelle connexion socket:', socket.id);

    // Enregistre tous les gestionnaires d'événements
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
