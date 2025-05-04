
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../middlewares/auth');

const clientChatFilePath = path.join(__dirname, '../data/client-chat.json');
const adminChatFilePath = path.join(__dirname, '../data/admin-chat.json');
const usersFilePath = path.join(__dirname, '../data/users.json');

// Vérifier si le fichier client-chat.json existe, sinon le créer
if (!fs.existsSync(clientChatFilePath)) {
  const initialData = { 
    conversations: {},
    onlineUsers: {},
    autoReplySent: {}
  };
  fs.writeFileSync(clientChatFilePath, JSON.stringify(initialData, null, 2));
}

// Marquer un utilisateur comme en ligne
router.post('/online', isAuthenticated, (req, res) => {
  try {
    const userId = req.user.id;
    const chatData = JSON.parse(fs.readFileSync(clientChatFilePath));
    
    if (!chatData.onlineUsers) {
      chatData.onlineUsers = {};
    }
    
    chatData.onlineUsers[userId] = {
      isOnline: true,
      lastSeen: new Date().toISOString()
    };
    
    fs.writeFileSync(clientChatFilePath, JSON.stringify(chatData, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut en ligne:", error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut en ligne' });
  }
});

// Marquer un utilisateur comme hors ligne
router.post('/offline', isAuthenticated, (req, res) => {
  try {
    const userId = req.user.id;
    const chatData = JSON.parse(fs.readFileSync(clientChatFilePath));
    
    if (!chatData.onlineUsers) {
      chatData.onlineUsers = {};
    }
    
    chatData.onlineUsers[userId] = {
      isOnline: false,
      lastSeen: new Date().toISOString()
    };
    
    fs.writeFileSync(clientChatFilePath, JSON.stringify(chatData, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut hors ligne:", error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut hors ligne' });
  }
});

// Vérifier si un utilisateur est en ligne
router.get('/status/:userId', isAuthenticated, (req, res) => {
  try {
    const { userId } = req.params;
    const chatData = JSON.parse(fs.readFileSync(clientChatFilePath));
    
    if (!chatData.onlineUsers || !chatData.onlineUsers[userId]) {
      return res.json({ isOnline: false });
    }
    
    // Si le dernier accès est plus ancien que 5 minutes, considérer l'utilisateur comme hors ligne
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    
    const lastSeen = new Date(chatData.onlineUsers[userId].lastSeen);
    const isOnline = chatData.onlineUsers[userId].isOnline && lastSeen > fiveMinutesAgo;
    
    res.json({ 
      isOnline, 
      lastSeen: chatData.onlineUsers[userId].lastSeen 
    });
  } catch (error) {
    console.error("Erreur lors de la vérification du statut en ligne:", error);
    res.status(500).json({ message: 'Erreur lors de la vérification du statut en ligne' });
  }
});

// Obtenir la liste des administrateurs disponibles pour le chat client
router.get('/service-admins', isAuthenticated, (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const admins = users.filter(user => user.role === 'admin');
    
    // Ne pas envoyer le mot de passe
    const safeAdmins = admins.map(admin => {
      const { password, passwordUnique, ...safeAdmin } = admin;
      return safeAdmin;
    });
    
    // Récupérer les statuts en ligne
    const chatData = JSON.parse(fs.readFileSync(clientChatFilePath));
    
    // Ajouter le statut en ligne à chaque admin
    const adminsWithStatus = safeAdmins.map(admin => {
      const userStatus = chatData.onlineUsers && chatData.onlineUsers[admin.id];
      return {
        ...admin,
        isOnline: userStatus ? userStatus.isOnline : false,
        lastSeen: userStatus ? userStatus.lastSeen : null
      };
    });
    
    res.json(adminsWithStatus);
  } catch (error) {
    console.error("Erreur lors de la récupération des administrateurs:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération des administrateurs' });
  }
});

// Obtenir les conversations d'un client
router.get('/conversations', isAuthenticated, (req, res) => {
  try {
    const chatData = JSON.parse(fs.readFileSync(clientChatFilePath));
    const userId = req.user.id;
    
    // Récupérer toutes les conversations où le client est impliqué
    const userConversations = {};
    
    for (const [conversationId, conversation] of Object.entries(chatData.conversations || {})) {
      if (conversationId.startsWith(`client-${userId}-`)) {
        userConversations[conversationId] = conversation;
      }
    }
    
    res.json(userConversations);
  } catch (error) {
    console.error("Erreur lors de la récupération des conversations:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération des conversations' });
  }
});

// Démarrer ou obtenir une conversation avec le service client
router.get('/service', isAuthenticated, (req, res) => {
  try {
    const chatData = JSON.parse(fs.readFileSync(clientChatFilePath));
    const userId = req.user.id;
    
    // Format du conversationId pour les chats service client
    const conversationId = `client-${userId}-service`;
    
    // Si la conversation n'existe pas, la créer
    if (!chatData.conversations) {
      chatData.conversations = {};
    }
    
    if (!chatData.conversations[conversationId]) {
      // Charger les admins pour les participants
      const users = JSON.parse(fs.readFileSync(usersFilePath));
      const admins = users.filter(user => user.role === 'admin').map(admin => admin.id);
      
      chatData.conversations[conversationId] = {
        messages: [],
        participants: [userId, ...admins], // Le client et tous les admins
        type: 'service' // Marquer comme conversation de type service client
      };
      
      // Message d'accueil automatique
      const welcomeMessage = {
        id: `msg-auto-${Date.now()}`,
        senderId: 'system',
        content: "Bienvenue dans notre service client en ligne. Un conseiller va vous répondre dans les plus brefs délais. Comment pouvons-nous vous aider?",
        timestamp: new Date().toISOString(),
        read: false,
        isSystemMessage: true
      };
      
      chatData.conversations[conversationId].messages.push(welcomeMessage);
      fs.writeFileSync(clientChatFilePath, JSON.stringify(chatData, null, 2));
    }
    
    res.json(chatData.conversations[conversationId]);
  } catch (error) {
    console.error("Erreur lors de la récupération du service client:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération du service client' });
  }
});

// Envoyer un message au service client
router.post('/service/message', isAuthenticated, (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;
    
    if (!message) {
      return res.status(400).json({ message: 'Message requis' });
    }
    
    const chatData = JSON.parse(fs.readFileSync(clientChatFilePath));
    
    // Format du conversationId pour les chats service client
    const conversationId = `client-${userId}-service`;
    
    // Si la conversation n'existe pas, la créer
    if (!chatData.conversations) {
      chatData.conversations = {};
    }
    
    if (!chatData.conversations[conversationId]) {
      // Charger les admins pour les participants
      const users = JSON.parse(fs.readFileSync(usersFilePath));
      const admins = users.filter(user => user.role === 'admin').map(admin => admin.id);
      
      chatData.conversations[conversationId] = {
        messages: [],
        participants: [userId, ...admins], // Le client et tous les admins
        type: 'service'
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
    
    // Vérifier si un admin est en ligne
    const adminChatData = JSON.parse(fs.readFileSync(adminChatFilePath));
    const isAnyAdminOnline = Object.entries(adminChatData.onlineUsers || {}).some(
      ([adminId, status]) => status.isOnline
    );
    
    // Si aucun admin n'est en ligne, envoyer un message automatique
    if (!isAnyAdminOnline) {
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
          senderId: 'system',
          content: "Merci pour votre message. Actuellement, aucun conseiller n'est disponible. Nous vous répondrons dès que possible pendant nos heures d'ouverture (lun-ven 9h-18h).",
          timestamp: new Date().toISOString(),
          read: false,
          isSystemMessage: true
        };
        
        chatData.conversations[conversationId].messages.push(autoMessage);
        chatData.autoReplySent[conversationId] = now.toISOString();
      }
    }
    
    fs.writeFileSync(clientChatFilePath, JSON.stringify(chatData, null, 2));
    
    res.status(201).json({
      message: newMessage,
      autoReply: !isAnyAdminOnline
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi du message:", error);
    res.status(500).json({ message: "Erreur lors de l'envoi du message" });
  }
});

// Admin: Obtenir toutes les conversations du service client
router.get('/admin/service', isAuthenticated, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const chatData = JSON.parse(fs.readFileSync(clientChatFilePath));
    const serviceConversations = {};
    
    // Filtrer les conversations de type service
    for (const [conversationId, conversation] of Object.entries(chatData.conversations || {})) {
      if (conversation.type === 'service') {
        serviceConversations[conversationId] = conversation;
      }
    }
    
    // Ajouter les informations utilisateur pour chaque conversation
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    
    for (const [conversationId, conversation] of Object.entries(serviceConversations)) {
      // Trouver l'ID du client basé sur le format 'client-{userId}-service'
      const clientId = conversationId.split('-')[1];
      const clientUser = users.find(user => user.id === clientId);
      
      if (clientUser) {
        const { password, passwordUnique, ...safeUser } = clientUser;
        serviceConversations[conversationId].clientInfo = safeUser;
      }
      
      // Compter les messages non lus pour cet admin
      const unreadCount = conversation.messages.filter(
        msg => !msg.read && msg.senderId !== req.user.id && msg.senderId !== 'system'
      ).length;
      
      serviceConversations[conversationId].unreadCount = unreadCount;
    }
    
    res.json(serviceConversations);
  } catch (error) {
    console.error("Erreur lors de la récupération des conversations service client:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération des conversations' });
  }
});

// Admin: Répondre à un message du service client
router.post('/admin/service/:conversationId/reply', isAuthenticated, (req, res) => {
  try {
    const { message } = req.body;
    const { conversationId } = req.params;
    const adminId = req.user.id;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    if (!message) {
      return res.status(400).json({ message: 'Message requis' });
    }
    
    const chatData = JSON.parse(fs.readFileSync(clientChatFilePath));
    
    if (!chatData.conversations || !chatData.conversations[conversationId]) {
      return res.status(404).json({ message: 'Conversation non trouvée' });
    }
    
    const conversation = chatData.conversations[conversationId];
    
    if (conversation.type !== 'service') {
      return res.status(400).json({ message: 'Cette conversation n\'est pas de type service client' });
    }
    
    const newMessage = {
      id: `msg-${Date.now()}`,
      senderId: adminId,
      content: message,
      timestamp: new Date().toISOString(),
      read: false,
      isAdminReply: true
    };
    
    conversation.messages.push(newMessage);
    fs.writeFileSync(clientChatFilePath, JSON.stringify(chatData, null, 2));
    
    res.status(201).json({ message: newMessage });
  } catch (error) {
    console.error("Erreur lors de l'envoi de la réponse admin:", error);
    res.status(500).json({ message: "Erreur lors de l'envoi de la réponse" });
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
    
    const chatData = JSON.parse(fs.readFileSync(clientChatFilePath));
    
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
    if (message.senderId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres messages' });
    }
    
    // Mettre à jour le contenu du message
    conversation.messages[messageIndex].content = content;
    conversation.messages[messageIndex].isEdited = true;
    
    fs.writeFileSync(clientChatFilePath, JSON.stringify(chatData, null, 2));
    
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
    
    const chatData = JSON.parse(fs.readFileSync(clientChatFilePath));
    
    if (!chatData.conversations || !chatData.conversations[conversationId]) {
      return res.status(404).json({ message: 'Conversation non trouvée' });
    }
    
    const conversation = chatData.conversations[conversationId];
    const messageIndex = conversation.messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex === -1) {
      return res.status(404).json({ message: 'Message non trouvé' });
    }
    
    const message = conversation.messages[messageIndex];
    
    // Vérifier que l'utilisateur est l'expéditeur du message ou un admin
    if (message.senderId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres messages' });
    }
    
    // Supprimer le message
    conversation.messages.splice(messageIndex, 1);
    
    fs.writeFileSync(clientChatFilePath, JSON.stringify(chatData, null, 2));
    
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
    
    const chatData = JSON.parse(fs.readFileSync(clientChatFilePath));
    
    if (!chatData.conversations || !chatData.conversations[conversationId]) {
      return res.status(404).json({ message: 'Conversation non trouvée' });
    }
    
    const conversation = chatData.conversations[conversationId];
    const messageIndex = conversation.messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex === -1) {
      return res.status(404).json({ message: 'Message non trouvé' });
    }
    
    // Vérifier que l'utilisateur fait partie de la conversation
    const isParticipant = conversation.participants.includes(req.user.id);
    if (!isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé à cette conversation' });
    }
    
    conversation.messages[messageIndex].read = true;
    fs.writeFileSync(clientChatFilePath, JSON.stringify(chatData, null, 2));
    
    res.json(conversation.messages[messageIndex]);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du message:", error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du message' });
  }
});

module.exports = router;
