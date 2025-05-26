
const jwt = require('jsonwebtoken');

const socketAuth = (socket, next) => {
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
};

module.exports = socketAuth;
