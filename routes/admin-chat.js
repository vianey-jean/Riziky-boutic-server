
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isAuthenticated, isAdmin } = require('../middlewares/auth');

const adminChatFilePath = path.join(__dirname, '../data/admin-chat.json');
const usersFilePath = path.join(__dirname, '../data/users.json');

// Vérifier si le fichier admin-chat.json existe, sinon le créer
if (!fs.existsSync(adminChatFilePath)) {
  const initialData = { 
    conversations: {},
    onlineUsers: {},
    autoReplySent: {}
  };
  fs.writeFileSync(adminChatFilePath, JSON.stringify(initialData, null, 2));
}

// Obtenir tous les admins pour le chat
router.get('/admins', isAuthenticated, isAdmin, (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const admins = users.filter(user => user.role === 'admin');
    
    // Ne pas envoyer le mot de passe
    const safeAdmins = admins.map(admin => {
      const { password, passwordUnique, ...safeAdmin } = admin;
      return safeAdmin;
    });
    
    // Récupérer les statuts en ligne
    const chatData = JSON.parse(fs.readFileSync(adminChatFilePath));
    
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

// Marquer un admin comme en ligne
router.post('/online', isAuthenticated, isAdmin, (req, res) => {
  try {
    const userId = req.user.id;
    const chatData = JSON.parse(fs.readFileSync(adminChatFilePath));
    
    if (!chatData.onlineUsers) {
      chatData.onlineUsers = {};
    }
    
    chatData.onlineUsers[userId] = {
      isOnline: true,
      lastSeen: new Date().toISOString()
    };
    
    fs.writeFileSync(adminChatFilePath, JSON.stringify(chatData, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut en ligne:", error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut en ligne' });
  }
});

// Marquer un admin comme hors ligne
router.post('/offline', isAuthenticated, isAdmin, (req, res) => {
  try {
    const userId = req.user.id;
    const chatData = JSON.parse(fs.readFileSync(adminChatFilePath));
    
    if (!chatData.onlineUsers) {
      chatData.onlineUsers = {};
    }
    
    chatData.onlineUsers[userId] = {
      isOnline: false,
      lastSeen: new Date().toISOString()
    };
    
    fs.writeFileSync(adminChatFilePath, JSON.stringify(chatData, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut hors ligne:", error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut hors ligne' });
  }
});

// Vérifier si un admin est en ligne
router.get('/status/:adminId', isAuthenticated, (req, res) => {
  try {
    const { adminId } = req.params;
    const chatData = JSON.parse(fs.readFileSync(adminChatFilePath));
    
    if (!chatData.onlineUsers || !chatData.onlineUsers[adminId]) {
      return res.json({ isOnline: false });
    }
    
    // Si le dernier accès est plus ancien que 5 minutes, considérer l'admin comme hors ligne
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    
    const lastSeen = new Date(chatData.onlineUsers[adminId].lastSeen);
    const isOnline = chatData.onlineUsers[adminId].isOnline && lastSeen > fiveMinutesAgo;
    
    res.json({ 
      isOnline, 
      lastSeen: chatData.onlineUsers[adminId].lastSeen 
    });
  } catch (error) {
    console.error("Erreur lors de la vérification du statut en ligne:", error);
    res.status(500).json({ message: 'Erreur lors de la vérification du statut en ligne' });
  }
});

// Obtenir les conversations d'un administrateur
router.get('/conversations', isAuthenticated, isAdmin, (req, res) => {
  try {
    const chatData = JSON.parse(fs.readFileSync(adminChatFilePath));
    const userId = req.user.id;
    
    // Récupérer toutes les conversations où l'admin est impliqué
    const userConversations = {};
    
    for (const [conversationId, conversation] of Object.entries(chatData.conversations || {})) {
      const [user1Id, user2Id] = conversationId.split('-');
      
      if (user1Id === userId || user2Id === userId) {
        userConversations[conversationId] = conversation;
      }
    }
    
    res.json(userConversations);
  } catch (error) {
    console.error("Erreur lors de la récupération des conversations:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération des conversations' });
  }
});

// Obtenir une conversation spécifique
router.get('/conversations/:adminId', isAuthenticated, isAdmin, (req, res) => {
  try {
    const chatData = JSON.parse(fs.readFileSync(adminChatFilePath));
    const userId = req.user.id;
    const otherAdminId = req.params.adminId;
    
    if (userId === otherAdminId) {
      return res.status(400).json({ message: 'Vous ne pouvez pas démarrer une conversation avec vous-même' });
    }
    
    // Vérifier que l'autre utilisateur est bien un admin
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const otherAdmin = users.find(user => user.id === otherAdminId && user.role === 'admin');
    
    if (!otherAdmin) {
      return res.status(404).json({ message: 'Administrateur non trouvé' });
    }
    
    // Créer l'ID de conversation (toujours avec l'ID le plus petit en premier)
    const conversationId = userId < otherAdminId 
      ? `${userId}-${otherAdminId}` 
      : `${otherAdminId}-${userId}`;
    
    // Si la conversation n'existe pas, la créer
    if (!chatData.conversations) {
      chatData.conversations = {};
    }
    
    if (!chatData.conversations[conversationId]) {
      chatData.conversations[conversationId] = {
        messages: [],
        participants: [userId, otherAdminId]
      };
      fs.writeFileSync(adminChatFilePath, JSON.stringify(chatData, null, 2));
    }
    
    res.json(chatData.conversations[conversationId]);
  } catch (error) {
    console.error("Erreur lors de la récupération de la conversation:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la conversation' });
  }
});

// Envoyer un message
router.post('/conversations/:adminId', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;
    const otherAdminId = req.params.adminId;
    
    if (!message) {
      return res.status(400).json({ message: 'Message requis' });
    }
    
    if (userId === otherAdminId) {
      return res.status(400).json({ message: 'Vous ne pouvez pas envoyer un message à vous-même' });
    }
    
    const chatData = JSON.parse(fs.readFileSync(adminChatFilePath));
    
    // Vérifier que l'autre utilisateur est bien un admin
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const otherAdmin = users.find(user => user.id === otherAdminId && user.role === 'admin');
    
    if (!otherAdmin) {
      return res.status(404).json({ message: 'Administrateur non trouvé' });
    }
    
    // Créer l'ID de conversation (toujours avec l'ID le plus petit en premier)
    const conversationId = userId < otherAdminId 
      ? `${userId}-${otherAdminId}` 
      : `${otherAdminId}-${userId}`;
    
    // Initialiser les conversations si nécessaire
    if (!chatData.conversations) {
      chatData.conversations = {};
    }
    
    // Si la conversation n'existe pas, la créer
    if (!chatData.conversations[conversationId]) {
      chatData.conversations[conversationId] = {
        messages: [],
        participants: [userId, otherAdminId]
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
    const isRecipientOnline = chatData.onlineUsers && 
                              chatData.onlineUsers[otherAdminId] && 
                              chatData.onlineUsers[otherAdminId].isOnline;
    
    // Si le destinataire n'est pas en ligne, envoyer un message automatique
    // mais seulement si un message auto n'a pas déjà été envoyé récemment dans cette conversation
    if (!isRecipientOnline) {
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
          senderId: otherAdminId,
          content: "Merci pour votre message. Je vais regarder ça dès que possible!",
          timestamp: new Date().toISOString(),
          read: false,
          isAutoReply: true
        };
        
        chatData.conversations[conversationId].messages.push(autoMessage);
        chatData.autoReplySent[conversationId] = now.toISOString();
      }
    }
    
    fs.writeFileSync(adminChatFilePath, JSON.stringify(chatData, null, 2));
    
    res.status(201).json({
      message: newMessage,
      autoReply: !isRecipientOnline
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi du message:", error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi du message' });
  }
});

// Modifier un message
router.put('/messages/:messageId/edit', isAuthenticated, isAdmin, (req, res) => {
  try {
    const { messageId } = req.params;
    const { content, conversationId } = req.body;
    const userId = req.user.id;
    
    if (!content || !conversationId) {
      return res.status(400).json({ message: 'Contenu et ID de conversation requis' });
    }
    
    const chatData = JSON.parse(fs.readFileSync(adminChatFilePath));
    
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
    
    fs.writeFileSync(adminChatFilePath, JSON.stringify(chatData, null, 2));
    
    res.json(conversation.messages[messageIndex]);
  } catch (error) {
    console.error("Erreur lors de la modification du message:", error);
    res.status(500).json({ message: 'Erreur lors de la modification du message' });
  }
});

// Supprimer un message
router.delete('/messages/:messageId', isAuthenticated, isAdmin, (req, res) => {
  try {
    const { messageId } = req.params;
    const { conversationId } = req.query;
    const userId = req.user.id;
    
    if (!conversationId) {
      return res.status(400).json({ message: 'ID de conversation requis' });
    }
    
    const chatData = JSON.parse(fs.readFileSync(adminChatFilePath));
    
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
    
    fs.writeFileSync(adminChatFilePath, JSON.stringify(chatData, null, 2));
    
    res.json({ success: true, message: 'Message supprimé avec succès' });
  } catch (error) {
    console.error("Erreur lors de la suppression du message:", error);
    res.status(500).json({ message: 'Erreur lors de la suppression du message' });
  }
});

// Marquer un message comme lu
router.put('/messages/:messageId/read', isAuthenticated, isAdmin, (req, res) => {
  try {
    const { messageId } = req.params;
    const { conversationId } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ message: 'ID de conversation requis' });
    }
    
    const chatData = JSON.parse(fs.readFileSync(adminChatFilePath));
    
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
    fs.writeFileSync(adminChatFilePath, JSON.stringify(chatData, null, 2));
    
    res.json(conversation.messages[messageIndex]);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du message:", error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du message' });
  }
});

// Nettoyer les conversations lorsqu'un utilisateur perd son rôle d'administrateur
// Cette route est appelée par l'API d'administration lors de la mise à jour d'un utilisateur
router.delete('/cleanup/:userId', isAuthenticated, isAdmin, (req, res) => {
  try {
    const userId = req.params.userId;
    const chatData = JSON.parse(fs.readFileSync(adminChatFilePath));
    
    // Parcourir toutes les conversations
    let conversationsToDelete = [];
    
    for (const [conversationId, conversation] of Object.entries(chatData.conversations || {})) {
      // Vérifier si l'utilisateur est un participant
      if (conversation.participants.includes(userId)) {
        conversationsToDelete.push(conversationId);
      }
    }
    
    // Supprimer les conversations
    conversationsToDelete.forEach(convId => {
      delete chatData.conversations[convId];
    });
    
    // Supprimer également les statuts en ligne
    if (chatData.onlineUsers && chatData.onlineUsers[userId]) {
      delete chatData.onlineUsers[userId];
    }
    
    // Supprimer les entrées autoReply
    Object.keys(chatData.autoReplySent || {}).forEach(convId => {
      if (convId.includes(userId)) {
        delete chatData.autoReplySent[convId];
      }
    });
    
    fs.writeFileSync(adminChatFilePath, JSON.stringify(chatData, null, 2));
    
    res.json({ 
      success: true, 
      message: `${conversationsToDelete.length} conversations supprimées pour l'utilisateur ${userId}`
    });
  } catch (error) {
    console.error("Erreur lors du nettoyage des conversations:", error);
    res.status(500).json({ message: 'Erreur lors du nettoyage des conversations' });
  }
});

module.exports = router;
