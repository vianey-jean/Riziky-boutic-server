
// Variables pour suivre les connexions actives et les appels
const activeUsers = new Map();
const activeCallsMap = new Map();

const handleAuthentication = (socket, io) => {
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
};

const handleVideoCallEvents = (socket, io) => {
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
};

const handleChatEvents = (socket, io) => {
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
};

const handleOrderEvents = (socket, io) => {
  // Notification pour nouvel ordre
  socket.on('new-order', (data) => {
    io.to('admins').emit('order-notification', {
      ...data,
      userId: socket.user.id,
      userName: socket.user.name || socket.user.email
    });
  });
};

const handleUtilityEvents = (socket, io) => {
  // Ping/Pong pour garder la connexion active
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
};

const handleDisconnection = (socket, io) => {
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
};

module.exports = {
  handleAuthentication,
  handleVideoCallEvents,
  handleChatEvents,
  handleOrderEvents,
  handleUtilityEvents,
  handleDisconnection
};
