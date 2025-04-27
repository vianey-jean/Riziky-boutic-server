
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isAuthenticated, isAdmin } = require('../middlewares/auth');

const usersFilePath = path.join(__dirname, '../data/users.json');

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
    if (req.user.id !== user.id && req.user.role !== 'admin') {
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
    if (req.user.id !== users[index].id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    // Préserver le rôle sauf si c'est un admin qui fait la modification
    const role = req.user.role === 'admin' ? req.body.role || users[index].role : users[index].role;
    
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

module.exports = router;
