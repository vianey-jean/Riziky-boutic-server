const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isAuthenticated, isAdmin } = require('../middlewares/auth');

const usersFilePath = path.join(__dirname, '../data/users.json');
const preferencesFilePath = path.join(__dirname, '../data/preferences.json');

// S'assurer que le fichier preferences.json existe
if (!fs.existsSync(preferencesFilePath)) {
  fs.writeFileSync(preferencesFilePath, JSON.stringify([], null, 2));
}

// Obtenir tous les utilisateurs (admin seulement)
router.get('/', isAuthenticated, isAdmin, (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    // Ne pas renvoyer les mots de passe
    const safeUsers = users.map(({ password, ...user }) => user);
    res.json(safeUsers);
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
    
    const { password, ...safeUser } = user;
    res.json(safeUser);
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

// Vérifier le mot de passe d'un utilisateur
router.post('/:id/verify-password', (req, res) => {
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
    
    // Vérification simple du mot de passe
    const isValid = user.password === password;
    
    res.json({ valid: isValid });
  } catch (error) {
    console.error("Erreur lors de la vérification du mot de passe:", error);
    res.status(500).json({ message: 'Erreur lors de la vérification du mot de passe' });
  }
});

// Mettre à jour le mot de passe d'un utilisateur - SANS AUTHENTIFICATION pour permettre le changement
router.put('/:id/password', (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Les mots de passe actuel et nouveau sont requis' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const index = users.findIndex(u => u.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Vérifier le mot de passe actuel
    if (users[index].password !== currentPassword) {
      return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
    }
    
    // Vérifier si le nouveau mot de passe est différent de l'ancien
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit être différent de l\'ancien' });
    }
    
    // Mettre à jour le mot de passe
    users[index].password = newPassword;
    
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    res.json({ message: 'Mot de passe mis à jour avec succès' });
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
