const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { isAuthenticated, isAdmin } = require('../middlewares/auth');

const usersFilePath = path.join(__dirname, '../data/users.json');
const preferencesFilePath = path.join(__dirname, '../data/preferences.json');
const saltRounds = 10; // Nombre de rounds pour le hashage bcrypt

// S'assurer que le fichier preferences.json existe
if (!fs.existsSync(preferencesFilePath)) {
  fs.writeFileSync(preferencesFilePath, JSON.stringify([], null, 2));
}

// Endpoint public pour vérifier un email et retourner le rôle (pour maintenance login)
router.post('/check-email-role', (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email requis' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const user = users.find(u => u.email === email);
    
    if (user) {
      res.json({ 
        exists: true, 
        role: user.role,
        email: user.email 
      });
    } else {
      res.json({ 
        exists: false 
      });
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'email:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification de l\'email' });
  }
});

// Obtenir tous les utilisateurs (admin seulement)
router.get('/', isAuthenticated, isAdmin, (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    // Pour les admins, on renvoie aussi les mots de passe pour la gestion
    const usersWithPasswords = users.map(user => ({
      ...user,
      // Les mots de passe ne sont montrés qu'aux admins
      password: user.password,
      passwordUnique: user.passwordUnique || ''
    }));
    res.json(usersWithPasswords);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs' });
  }
});

// Obtenir un utilisateur par ID
router.get('/:id', isAuthenticated, (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const user = users.find(u => u.id === req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Vérifier que l'utilisateur demande ses propres infos ou est admin
    if (req.user && req.user.id !== user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    // Ne pas envoyer le mot de passe à moins que ce soit un admin
    const { password, ...safeUser } = user;
    res.json(req.user.role === 'admin' ? user : safeUser);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'utilisateur' });
  }
});

// Mettre à jour un utilisateur
router.put('/:id', isAuthenticated, (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const index = users.findIndex(u => u.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Vérifier que l'utilisateur modifie ses propres infos ou est admin
    if (req.user && req.user.id !== users[index].id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    // Préserver le rôle sauf si c'est un admin qui fait la modification
    const role = req.user && req.user.role === 'admin' ? req.body.role || users[index].role : users[index].role;
    
    users[index] = {
      ...users[index],
      ...req.body,
      role,
      id: req.params.id // S'assurer que l'ID ne change pas
    };
    
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    const { password, ...safeUser } = users[index];
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'utilisateur' });
  }
});

// Définir un mot de passe temporaire (admin seulement)
router.put('/:id/temp-password', isAuthenticated, isAdmin, (req, res) => {
  try {
    const { passwordUnique } = req.body;
    
    if (!passwordUnique) {
      return res.status(400).json({ message: 'Mot de passe temporaire requis' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const index = users.findIndex(u => u.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Mettre à jour le mot de passe temporaire
    users[index].passwordUnique = passwordUnique;
    
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    res.json({ message: 'Mot de passe temporaire défini avec succès' });
  } catch (error) {
    console.error("Erreur lors de la définition du mot de passe temporaire:", error);
    res.status(500).json({ message: 'Erreur lors de la définition du mot de passe temporaire' });
  }
});

// Supprimer un utilisateur (admin seulement)
router.delete('/:id', isAuthenticated, isAdmin, (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const filteredUsers = users.filter(u => u.id !== req.params.id);
    
    if (filteredUsers.length === users.length) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    fs.writeFileSync(usersFilePath, JSON.stringify(filteredUsers, null, 2));
    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'utilisateur' });
  }
});

// Supprimer son propre profil avec vérification du mot de passe
router.delete('/:id/profile', isAuthenticated, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: 'Mot de passe requis pour supprimer le profil' });
    }
    
    // Vérifier que l'utilisateur supprime son propre profil
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Vous ne pouvez supprimer que votre propre profil' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const user = users.find(u => u.id === req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Vérifier le mot de passe
    let isPasswordValid;
    
    if (user.password.startsWith('$2')) {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } else {
      isPasswordValid = (user.password === password);
    }
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Mot de passe incorrect' });
    }
    
    // Supprimer toutes les données liées à l'utilisateur
    const userId = req.params.id;
    
    // Chemins des fichiers de données
    const dataFiles = [
      { path: path.join(__dirname, '../data/favorites.json'), filterKey: 'userId' },
      { path: path.join(__dirname, '../data/panier.json'), filterKey: 'userId' },
      { path: path.join(__dirname, '../data/orders.json'), filterKey: 'userId' },
      { path: path.join(__dirname, '../data/commandes.json'), filterKey: 'userId' },
      { path: path.join(__dirname, '../data/reviews.json'), filterKey: 'userId' },
      { path: path.join(__dirname, '../data/preferences.json'), filterKey: 'userId' },
      { path: path.join(__dirname, '../data/contacts.json'), filterKey: 'userId' },
      { path: path.join(__dirname, '../data/client-chat.json'), filterKey: 'userId' },
      { path: path.join(__dirname, '../data/cartes-bancaires.json'), filterKey: 'userId' }
    ];
    
    // Supprimer les données de chaque fichier
    for (const dataFile of dataFiles) {
      try {
        if (fs.existsSync(dataFile.path)) {
          const data = JSON.parse(fs.readFileSync(dataFile.path));
          const filteredData = data.filter(item => item[dataFile.filterKey] !== userId);
          fs.writeFileSync(dataFile.path, JSON.stringify(filteredData, null, 2));
        }
      } catch (fileError) {
        console.error(`Erreur lors de la suppression des données dans ${dataFile.path}:`, fileError);
      }
    }
    
    // Supprimer l'utilisateur lui-même
    const filteredUsers = users.filter(u => u.id !== userId);
    fs.writeFileSync(usersFilePath, JSON.stringify(filteredUsers, null, 2));
    
    res.json({ message: 'Profil et toutes les données associées supprimés avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du profil:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du profil' });
  }
});

// Vérifier le mot de passe d'un utilisateur
router.post('/:id/verify-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Mot de passe requis' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const user = users.find(u => u.id === req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Vérification du mot de passe avec bcrypt (même logique que le login)
    let isValid;
    
    if (user.password.startsWith('$2')) {
      // Le mot de passe est déjà hashé avec bcrypt
      isValid = await bcrypt.compare(password, user.password);
    } else {
      // Mot de passe en clair (pour rétrocompatibilité)
      isValid = (user.password === password);
      
      // Mise à jour du mot de passe avec hashage si correct
      if (isValid) {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const userIndex = users.findIndex(u => u.id === user.id);
        users[userIndex].password = hashedPassword;
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
      }
    }
    
    res.json({ valid: isValid });
  } catch (error) {
    console.error("Erreur lors de la vérification du mot de passe:", error);
    res.status(500).json({ message: 'Erreur lors de la vérification du mot de passe' });
  }
});

// Mettre à jour le mot de passe d'un utilisateur
router.put('/:id/password', async (req, res) => {
  try {
    const { currentPassword, newPassword, passwordUnique } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ message: 'Le nouveau mot de passe est requis' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const index = users.findIndex(u => u.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Cas 1: Utilisation du mot de passe à usage unique
    if (passwordUnique) {
      let isCodeValid = false;
      if (users[index].passwordUnique && users[index].passwordUnique.startsWith('$2')) {
        // Si le code est hashé
        isCodeValid = await bcrypt.compare(passwordUnique, users[index].passwordUnique);
      } else {
        // Pour la rétrocompatibilité
        isCodeValid = (users[index].passwordUnique === passwordUnique);
      }
      
      if (!isCodeValid) {
        return res.status(401).json({ message: 'Code temporaire invalide' });
      }
      
      // Hasher le nouveau mot de passe (même logique que l'inscription)
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      
      // Mettre à jour le mot de passe et supprimer le mot de passe à usage unique
      users[index].password = hashedPassword;
      users[index].passwordUnique = "";
      
      fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
      return res.json({ message: 'Mot de passe mis à jour avec succès' });
    }
    // Cas 2: Utilisation du mot de passe actuel
    else if (currentPassword) {
      // Vérifier le mot de passe actuel avec bcrypt (même logique que le login)
      let isCurrentPasswordValid;
      
      if (users[index].password.startsWith('$2')) {
        // Le mot de passe est déjà hashé avec bcrypt
        isCurrentPasswordValid = await bcrypt.compare(currentPassword, users[index].password);
      } else {
        // Mot de passe en clair (pour rétrocompatibilité)
        isCurrentPasswordValid = (users[index].password === currentPassword);
        
        // Mise à jour du mot de passe avec hashage si correct
        if (isCurrentPasswordValid) {
          const hashedCurrentPassword = await bcrypt.hash(currentPassword, saltRounds);
          users[index].password = hashedCurrentPassword;
        }
      }
      
      if (!isCurrentPasswordValid) {
        return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
      }
      
      // Vérifier si le nouveau mot de passe est différent de l'ancien
      const isSamePassword = await bcrypt.compare(newPassword, users[index].password);
      if (isSamePassword) {
        return res.status(400).json({ message: 'Le nouveau mot de passe doit être différent de l\'ancien' });
      }
      
      // Hasher le nouveau mot de passe (même logique que l'inscription)
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
      
      // Mettre à jour le mot de passe
      users[index].password = hashedNewPassword;
      
      fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
      return res.json({ message: 'Mot de passe mis à jour avec succès' });
    } else {
      return res.status(400).json({ message: 'Mot de passe actuel ou mot de passe à usage unique requis' });
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour du mot de passe:", error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du mot de passe' });
  }
});

// Obtenir les préférences d'un utilisateur
router.get('/:id/preferences', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur demande ses propres préférences ou est admin
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const preferences = JSON.parse(fs.readFileSync(preferencesFilePath));
    const userPrefs = preferences.find(p => p.userId === req.params.id);
    
    if (!userPrefs) {
      // Si aucune préférence n'est trouvée, renvoyer les préférences par défaut
      return res.json({
        emailNotifications: true,
        marketingEmails: false,
        productUpdates: true,
        orderStatusUpdates: true
      });
    }
    
    res.json(userPrefs.preferences);
  } catch (error) {
    console.error("Erreur lors de la récupération des préférences:", error);
    res.status(500).json({ message: 'Erreur lors de la récupération des préférences' });
  }
});

// Sauvegarder les préférences d'un utilisateur
router.post('/:id/preferences', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur modifie ses propres préférences ou est admin
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const preferences = JSON.parse(fs.readFileSync(preferencesFilePath));
    const index = preferences.findIndex(p => p.userId === req.params.id);
    
    if (index === -1) {
      // Ajouter de nouvelles préférences
      preferences.push({
        userId: req.params.id,
        preferences: {
          emailNotifications: req.body.emailNotifications || true,
          marketingEmails: req.body.marketingEmails || false,
          productUpdates: req.body.productUpdates || true,
          orderStatusUpdates: req.body.orderStatusUpdates || true
        }
      });
    } else {
      // Mettre à jour les préférences existantes
      preferences[index].preferences = {
        emailNotifications: req.body.emailNotifications !== undefined ? req.body.emailNotifications : preferences[index].preferences.emailNotifications,
        marketingEmails: req.body.marketingEmails !== undefined ? req.body.marketingEmails : preferences[index].preferences.marketingEmails,
        productUpdates: req.body.productUpdates !== undefined ? req.body.productUpdates : preferences[index].preferences.productUpdates,
        orderStatusUpdates: req.body.orderStatusUpdates !== undefined ? req.body.orderStatusUpdates : preferences[index].preferences.orderStatusUpdates
      };
    }
    
    fs.writeFileSync(preferencesFilePath, JSON.stringify(preferences, null, 2));
    res.json({ message: 'Préférences mises à jour avec succès' });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement des préférences:", error);
    res.status(500).json({ message: 'Erreur lors de l\'enregistrement des préférences' });
  }
});

module.exports = router;
