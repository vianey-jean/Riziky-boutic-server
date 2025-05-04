const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../middlewares/auth');

const chatClientFilePath = path.join(__dirname, '../data/chatclient.json');
const usersFilePath = path.join(__dirname, '../data/users.json');

// Vérifier si le fichier chatclient.json existe, sinon le créer
if (!fs.existsSync(chatClientFilePath)) {
  const initialData = { 
    conversations: {},
    onlineUsers: {},
    autoReplySent: {}
  };
  fs.writeFileSync(chatClientFilePath, JSON.stringify(initialData, null, 2));
}

// Fonction utilitaire pour lire les fichiers JSON avec retry
const readJsonFileWithRetry = (filePath, retries = 3) => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContent);
    } catch (error) {
      attempt++;
      if (attempt === retries) throw error;
      // Petite pause avant de réessayer
      const waitTime = 50 * attempt;
      console.log(`Erreur lors de la lecture du fichier, nouvel essai dans ${waitTime}ms...`);
      // Attente synchrone simple
      const start = new Date().getTime();
      while (new Date().getTime() < start + waitTime);
    }
  }
};

// Fonction utilitaire pour écrire des fichiers JSON avec retry
const writeJsonFileWithRetry = (filePath, data, retries = 3) => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      attempt++;
      if (attempt === retries) throw error;
      // Petite pause avant de réessayer
      const waitTime = 50 * attempt;
      console.log(`Erreur lors de l'écriture du fichier, nouvel essai dans ${waitTime}ms...`);
      // Attente synchrone simple
      const start = new Date().getTime();
      while (new Date().getTime() < start + waitTime);
    }
  }
};

// Obtenir le service client (admin)
router.get('/service-client', isAuthenticated, (req, res) => {
  try {
    const users = readJsonFileWithRetry(usersFilePath);
    const serviceClient = users.find(user => user.role === 'admin' && user.email === 'service.client@example.com');
    
    if (!serviceClient) {
      return res.status(404).json({ message: 'Service client non trouvé' });
    }
    
    // Ne pas envoyer le mot de passe
    const { password, passwordUnique, ...safeServiceClient } = serviceClient;
    
    res.json(safeServiceClient);
  } catch (error) {
    console.error("Erreur lors de la récupération du service client:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération du service client' });
  }
});

// Obtenir une conversation spécifique client-admin
router.get('/conversations', isAuthenticated, (req, res) => {
  try {
    // Toujours relire le fichier pour éviter les problèmes de cache côté serveur
    const chatData = readJsonFileWithRetry(chatClientFilePath);
    const userId = req.user.id;
    
    // Pour un client, récupérer sa conversation avec le service client
    // Pour le service client, récupérer toutes les conversations
    let userConversations = {};
    
    if (req.user.role === 'admin' && req.user.email === 'service.client@example.com') {
      // L'utilisateur est le service client, renvoyer toutes les conversations
      userConversations = chatData.conversations || {};
    } else {
      // L'utilisateur est un client, récupérer sa conversation avec le service client
      const users = readJsonFileWithRetry(usersFilePath);
      const serviceClient = users.find(user => user.role === 'admin' && user.email === 'service.client@example.com');
      
      if (!serviceClient) {
        return res.status(404).json({ message: 'Service client non trouvé' });
      }
      
      const conversationId = userId < serviceClient.id 
        ? `${userId}-${serviceClient.id}` 
        : `${serviceClient.id}-${userId}`;
      
      if (chatData.conversations && chatData.conversations[conversationId]) {
        userConversations[conversationId] = chatData.conversations[conversationId];
      }
    }
    
    res.json(userConversations);
  } catch (error) {
    console.error("Erreur lors de la récupération des conversations:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération des conversations' });
  }
});

// Obtenir une conversation spécifique avec un client
router.get('/conversations/:clientId', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur est le service client
    const users = readJsonFileWithRetry(usersFilePath);
    const serviceClient = users.find(user => user.role === 'admin' && user.email === 'service.client@example.com');
    
    if (!serviceClient || req.user.id !== serviceClient.id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const clientId = req.params.clientId;
    // Toujours relire le fichier pour éviter les problèmes de cache côté serveur
    const chatData = readJsonFileWithRetry(chatClientFilePath);
    
    // Créer l'ID de conversation (toujours avec l'ID le plus petit en premier)
    const conversationId = serviceClient.id < clientId 
      ? `${serviceClient.id}-${clientId}` 
      : `${clientId}-${serviceClient.id}`;
    
    // Si la conversation n'existe pas, la créer
    if (!chatData.conversations) {
      chatData.conversations = {};
    }
    
    if (!chatData.conversations[conversationId]) {
      chatData.conversations[conversationId] = {
        messages: [],
        participants: [serviceClient.id, clientId]
      };
      writeJsonFileWithRetry(chatClientFilePath, chatData);
    }
    
    // Ajouter un log pour débogage
    console.log(`[DEBUG] Conversation du client ${clientId} récupérée:`, JSON.stringify(chatData.conversations[conversationId], null, 2));
    
    res.json(chatData.conversations[conversationId]);
  } catch (error) {
    console.error("Erreur lors de la récupération de la conversation:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la conversation' });
  }
});

// Obtenir la conversation d'un client avec le service client
router.get('/my-conversation', isAuthenticated, (req, res) => {
  try {
    const userId = req.user.id;
    
    // Récupérer l'ID du service client
    const users = readJsonFileWithRetry(usersFilePath);
    const serviceClient = users.find(user => user.role === 'admin' && user.email === 'service.client@example.com');
    
    if (!serviceClient) {
      return res.status(404).json({ message: 'Service client non trouvé' });
    }
    
    // Créer l'ID de conversation
    const conversationId = userId < serviceClient.id 
      ? `${userId}-${serviceClient.id}` 
      : `${serviceClient.id}-${userId}`;
    
    // Toujours relire le fichier pour éviter les problèmes de cache côté serveur
    const chatData = readJsonFileWithRetry(chatClientFilePath);
    
    // Si la conversation n'existe pas, la créer
    if (!chatData.conversations) {
      chatData.conversations = {};
    }
    
    if (!chatData.conversations[conversationId]) {
      chatData.conversations[conversationId] = {
        messages: [],
        participants: [userId, serviceClient.id]
      };
      writeJsonFileWithRetry(chatClientFilePath, chatData);
    }
    
    // Ajouter un log pour débogage
    console.log(`[DEBUG] Ma conversation récupérée (user ${userId}):`, JSON.stringify(chatData.conversations[conversationId], null, 2));
    
    res.json(chatData.conversations[conversationId]);
  } catch (error) {
    console.error("Erreur lors de la récupération de la conversation:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la conversation' });
  }
});

// Envoyer un message
router.post('/messages', isAuthenticated, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;
    
    if (!message) {
      return res.status(400).json({ message: 'Message requis' });
    }
    
    // Récupérer l'ID du service client
    const users = readJsonFileWithRetry(usersFilePath);
    const serviceClient = users.find(user => user.role === 'admin' && user.email === 'service.client@example.com');
    
    if (!serviceClient) {
      return res.status(404).json({ message: 'Service client non trouvé' });
    }
    
    // Créer l'ID de conversation (toujours avec l'ID le plus petit en premier)
    const conversationId = userId < serviceClient.id 
      ? `${userId}-${serviceClient.id}` 
      : `${serviceClient.id}-${userId}`;
    
    const chatData = readJsonFileWithRetry(chatClientFilePath);
    
    // Initialiser les conversations si nécessaire
    if (!chatData.conversations) {
      chatData.conversations = {};
    }
    
    // Si la conversation n'existe pas, la créer
    if (!chatData.conversations[conversationId]) {
      chatData.conversations[conversationId] = {
        messages: [],
        participants: [userId, serviceClient.id]
      };
    }
    
    const newMessage = {
      id: `msg-${Date.now()}`,
      senderId: userId,
      content: message,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    chatData.conversations[conversationId].messages.push(newMessage);
    
    // Vérifier si le destinataire est en ligne
    const isServiceClientOnline = userId !== serviceClient.id && 
                                 chatData.onlineUsers && 
                                 chatData.onlineUsers[serviceClient.id] && 
                                 chatData.onlineUsers[serviceClient.id].isOnline;
    
    // Si le service client n'est pas en ligne et que l'expéditeur est un client, envoyer un message automatique
    if (!isServiceClientOnline && userId !== serviceClient.id) {
      // Initialiser l'objet autoReplySent s'il n'existe pas
      if (!chatData.autoReplySent) {
        chatData.autoReplySent = {};
      }
      
      const lastAutoReply = chatData.autoReplySent[conversationId];
      const now = new Date();
      let shouldSendAutoReply = true;
      
      if (lastAutoReply) {
        const lastReplyTime = new Date(lastAutoReply);
        // Ne pas envoyer de réponse automatique si la dernière a été envoyée il y a moins de 2 heures
        shouldSendAutoReply = (now.getTime() - lastReplyTime.getTime()) > (2 * 60 * 60 * 1000);
      }
      
      if (shouldSendAutoReply) {
        const autoMessage = {
          id: `msg-auto-${Date.now()}`,
          senderId: serviceClient.id,
          content: "Merci pour votre message. Un conseiller du service client vous répondra dès que possible.",
          timestamp: new Date().toISOString(),
          read: false,
          isAutoReply: true
        };
        
        chatData.conversations[conversationId].messages.push(autoMessage);
        chatData.autoReplySent[conversationId] = now.toISOString();
      }
    }
    
    writeJsonFileWithRetry(chatClientFilePath, chatData);
    
    res.status(201).json({
      message: newMessage,
      autoReply: !isServiceClientOnline && userId !== serviceClient.id
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi du message:", error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi du message' });
  }
});

// Modifier un message
router.put('/messages/:messageId', isAuthenticated, (req, res) => {
  try {
    const { messageId } = req.params;
    const { content, conversationId } = req.body;
    const userId = req.user.id;
    
    if (!content || !conversationId) {
      return res.status(400).json({ message: 'Contenu et ID de conversation requis' });
    }
    
    const chatData = readJsonFileWithRetry(chatClientFilePath);
    
    if (!chatData.conversations || !chatData.conversations[conversationId]) {
      return res.status(404).json({ message: 'Conversation non trouvée' });
    }
    
    const conversation = chatData.conversations[conversationId];
    const messageIndex = conversation.messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex === -1) {
      return res.status(404).json({ message: 'Message non trouvé' });
    }
    
    const message = conversation.messages[messageIndex];
    
    // Vérifier que l'utilisateur est l'expéditeur du message
    if (message.senderId !== userId) {
      return res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres messages' });
    }
    
    // Mettre à jour le contenu du message
    conversation.messages[messageIndex].content = content;
    conversation.messages[messageIndex].isEdited = true;
    
    writeJsonFileWithRetry(chatClientFilePath, chatData);
    
    res.json(conversation.messages[messageIndex]);
  } catch (error) {
    console.error("Erreur lors de la modification du message:", error);
    res.status(500).json({ message: 'Erreur lors de la modification du message' });
  }
});

// Supprimer un message
router.delete('/messages/:messageId', isAuthenticated, (req, res) => {
  try {
    const { messageId } = req.params;
    const { conversationId } = req.query;
    const userId = req.user.id;
    
    if (!conversationId) {
      return res.status(400).json({ message: 'ID de conversation requis' });
    }
    
    const chatData = readJsonFileWithRetry(chatClientFilePath);
    
    if (!chatData.conversations || !chatData.conversations[conversationId]) {
      return res.status(404).json({ message: 'Conversation non trouvée' });
    }
    
    const conversation = chatData.conversations[conversationId];
    const messageIndex = conversation.messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex === -1) {
      return res.status(404).json({ message: 'Message non trouvé' });
    }
    
    const message = conversation.messages[messageIndex];
    
    // Vérifier que l'utilisateur est l'expéditeur du message
    if (message.senderId !== userId) {
      return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres messages' });
    }
    
    // Supprimer le message
    conversation.messages.splice(messageIndex, 1);
    
    writeJsonFileWithRetry(chatClientFilePath, chatData);
    
    res.json({ success: true, message: 'Message supprimé avec succès' });
  } catch (error) {
    console.error("Erreur lors de la suppression du message:", error);
    res.status(500).json({ message: 'Erreur lors de la suppression du message' });
  }
});

// Marquer un message comme lu
router.put('/messages/:messageId/read', isAuthenticated, (req, res) => {
  try {
    const { messageId } = req.params;
    const { conversationId } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ message: 'ID de conversation requis' });
    }
    
    const chatData = readJsonFileWithRetry(chatClientFilePath);
    
    if (!chatData.conversations || !chatData.conversations[conversationId]) {
      return res.status(404).json({ message: 'Conversation non trouvée' });
    }
    
    const conversation = chatData.conversations[conversationId];
    const messageIndex = conversation.messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex === -1) {
      return res.status(404).json({ message: 'Message non trouvé' });
    }
    
    // Vérifier que l'utilisateur fait partie de la conversation
    const [user1Id, user2Id] = conversationId.split('-');
    if (req.user.id !== user1Id && req.user.id !== user2Id) {
      return res.status(403).json({ message: 'Accès non autorisé à cette conversation' });
    }
    
    conversation.messages[messageIndex].read = true;
    writeJsonFileWithRetry(chatClientFilePath, chatData);
    
    res.json(conversation.messages[messageIndex]);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du message:", error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du message' });
  }
});

// Pour le service client : obtenir la liste des clients qui ont des conversations
router.get('/clients', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur est le service client
    const users = readJsonFileWithRetry(usersFilePath);
    const serviceClient = users.find(user => user.role === 'admin' && user.email === 'service.client@example.com');
    
    if (!serviceClient || req.user.id !== serviceClient.id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const chatData = readJsonFileWithRetry(chatClientFilePath);
    
    // Trouver toutes les conversations du service client
    const clientIds = new Set();
    for (const [conversationId, conversation] of Object.entries(chatData.conversations || {})) {
      if (conversation.participants.includes(serviceClient.id)) {
        // Ajouter l'ID du client (pas celui du service client)
        const clientId = conversation.participants.find(id => id !== serviceClient.id);
        if (clientId) {
          clientIds.add(clientId);
        }
      }
    }
    
    // Récupérer les informations des clients
    const clients = [];
    for (const clientId of clientIds) {
      const client = users.find(user => user.id === clientId);
      if (client) {
        // Ne pas envoyer le mot de passe
        const { password, passwordUnique, ...safeClient } = client;
        
        // Vérifier s'il y a des messages non lus
        const unreadMessages = [];
        for (const [conversationId, conversation] of Object.entries(chatData.conversations || {})) {
          if (conversation.participants.includes(clientId) && conversation.participants.includes(serviceClient.id)) {
            unreadMessages.push(...conversation.messages.filter(msg => 
              msg.senderId === clientId && !msg.read
            ));
          }
        }
        
        clients.push({
          ...safeClient,
          unreadCount: unreadMessages.length,
          lastMessage: unreadMessages.length > 0 ? 
            unreadMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] : null
        });
      }
    }
    
    res.json(clients);
  } catch (error) {
    console.error("Erreur lors de la récupération des clients:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération des clients' });
  }
});

// Marquer le service client comme en ligne
router.post('/service-client/online', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur est le service client
    const users = readJsonFileWithRetry(usersFilePath);
    const serviceClient = users.find(user => user.role === 'admin' && user.email === 'service.client@example.com');
    
    if (!serviceClient || req.user.id !== serviceClient.id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const chatData = readJsonFileWithRetry(chatClientFilePath);
    
    if (!chatData.onlineUsers) {
      chatData.onlineUsers = {};
    }
    
    chatData.onlineUsers[serviceClient.id] = {
      isOnline: true,
      lastSeen: new Date().toISOString()
    };
    
    writeJsonFileWithRetry(chatClientFilePath, chatData);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut en ligne:", error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut en ligne' });
  }
});

// Marquer le service client comme hors ligne
router.post('/service-client/offline', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur est le service client
    const users = readJsonFileWithRetry(usersFilePath);
    const serviceClient = users.find(user => user.role === 'admin' && user.email === 'service.client@example.com');
    
    if (!serviceClient || req.user.id !== serviceClient.id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const chatData = readJsonFileWithRetry(chatClientFilePath);
    
    if (!chatData.onlineUsers) {
      chatData.onlineUsers = {};
    }
    
    chatData.onlineUsers[serviceClient.id] = {
      isOnline: false,
      lastSeen: new Date().toISOString()
    };
    
    writeJsonFileWithRetry(chatClientFilePath, chatData);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut hors ligne:", error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut hors ligne' });
  }
});

// Vérifier si le service client est en ligne
router.get('/service-client/status', (req, res) => {
  try {
    // Récupérer l'ID du service client
    const users = readJsonFileWithRetry(usersFilePath);
    const serviceClient = users.find(user => user.role === 'admin' && user.email === 'service.client@example.com');
    
    if (!serviceClient) {
      return res.status(404).json({ message: 'Service client non trouvé' });
    }
    
    const chatData = readJsonFileWithRetry(chatClientFilePath);
    
    if (!chatData.onlineUsers || !chatData.onlineUsers[serviceClient.id]) {
      return res.json({ isOnline: false });
    }
    
    // Si le dernier accès est plus ancien que 5 minutes, considérer le service client comme hors ligne
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    
    const lastSeen = new Date(chatData.onlineUsers[serviceClient.id].lastSeen);
    const isOnline = chatData.onlineUsers[serviceClient.id].isOnline && lastSeen > fiveMinutesAgo;
    
    res.json({ 
      isOnline, 
      lastSeen: chatData.onlineUsers[serviceClient.id].lastSeen 
    });
  } catch (error) {
    console.error("Erreur lors de la vérification du statut en ligne:", error);
    res.status(500).json({ message: 'Erreur lors de la vérification du statut en ligne' });
  }
});

module.exports = router;
