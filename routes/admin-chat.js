
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isAuthenticated, isAdmin } = require('../middlewares/auth');

const adminChatFilePath = path.join(__dirname, '../data/admin-chat.json');

// Vérifier si le fichier admin-chat.json existe, sinon le créer
if (!fs.existsSync(adminChatFilePath)) {
  const initialData = { conversations: {} };
  fs.writeFileSync(adminChatFilePath, JSON.stringify(initialData, null, 2));
}

// Obtenir tous les admins pour le chat
router.get('/admins', isAuthenticated, isAdmin, (req, res) => {
  try {
    const usersFilePath = path.join(__dirname, '../data/users.json');
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const admins = users.filter(user => user.role === 'admin');
    
    // Ne pas envoyer le mot de passe
    const safeAdmins = admins.map(admin => {
      const { password, ...safeAdmin } = admin;
      return safeAdmin;
    });
    
    res.json(safeAdmins);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des administrateurs' });
  }
});

// Obtenir les conversations d'un administrateur
router.get('/conversations', isAuthenticated, isAdmin, (req, res) => {
  try {
    const chatData = JSON.parse(fs.readFileSync(adminChatFilePath));
    const userId = req.user.id;
    
    // Récupérer toutes les conversations où l'admin est impliqué
    const userConversations = {};
    
    for (const [conversationId, conversation] of Object.entries(chatData.conversations)) {
      const [user1Id, user2Id] = conversationId.split('-');
      
      if (user1Id === userId || user2Id === userId) {
        userConversations[conversationId] = conversation;
      }
    }
    
    res.json(userConversations);
  } catch (error) {
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
    
    // Créer l'ID de conversation (toujours avec l'ID le plus petit en premier)
    const conversationId = userId < otherAdminId 
      ? `${userId}-${otherAdminId}` 
      : `${otherAdminId}-${userId}`;
    
    // Si la conversation n'existe pas, la créer
    if (!chatData.conversations[conversationId]) {
      chatData.conversations[conversationId] = {
        messages: [],
        participants: [userId, otherAdminId]
      };
      fs.writeFileSync(adminChatFilePath, JSON.stringify(chatData, null, 2));
    }
    
    res.json(chatData.conversations[conversationId]);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération de la conversation' });
  }
});

// Envoyer un message
router.post('/conversations/:adminId', isAuthenticated, isAdmin, (req, res) => {
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
    const usersFilePath = path.join(__dirname, '../data/users.json');
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
    fs.writeFileSync(adminChatFilePath, JSON.stringify(chatData, null, 2));
    
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'envoi du message' });
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
    
    if (!chatData.conversations[conversationId]) {
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
    res.status(500).json({ message: 'Erreur lors de la mise à jour du message' });
  }
});

module.exports = router;
