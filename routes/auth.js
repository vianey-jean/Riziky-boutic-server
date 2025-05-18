
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { isAuthenticated } = require('../middlewares/auth');
const secretKey = 'your_jwt_secret'; // Devrais être dans une variable d'environnement

const usersFilePath = path.join(__dirname, '../data/users.json');
const saltRounds = 10; // Nombre de rounds pour le hashage bcrypt

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    // Vérification du mot de passe avec bcrypt
    let isPasswordValid;
    
    if (user.password.startsWith('$2')) {
      // Le mot de passe est déjà hashé avec bcrypt
      isPasswordValid = await bcrypt.compare(password, user.password);
    } else {
      // Mot de passe en clair (pour rétrocompatibilité)
      isPasswordValid = (user.password === password);
      
      // Mise à jour du mot de passe avec hashage si correct
      if (isPasswordValid) {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const userIndex = users.findIndex(u => u.id === user.id);
        users[userIndex].password = hashedPassword;
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
      }
    }
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    const token = jwt.sign({ 
      id: user.id,
      email: user.email,
      role: user.role
    }, secretKey, { expiresIn: '72h' });
    
    const { password: userPassword, ...userWithoutPassword } = user;
    
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error('Erreur de connexion:', error);
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { nom, email, password } = req.body;
    
    if (!nom || !email || !password) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    
    if (users.some(user => user.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }
    
    // Hashage du mot de passe
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const newUser = {
      id: String(Date.now()),
      nom,
      email,
      password: hashedPassword, // Mot de passe hashé
      role: 'client',
      dateCreation: new Date().toISOString()
    };
    
    users.push(newUser);
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    
    const token = jwt.sign({ 
      id: newUser.id,
      email: newUser.email,
      role: newUser.role
    }, secretKey, { expiresIn: '72h' });
    
    const { password: userPassword, ...userWithoutPassword } = newUser;
    
    res.status(201).json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error('Erreur d\'inscription:', error);
    res.status(500).json({ message: 'Erreur lors de l\'inscription' });
  }
});

// Verify token
router.get('/verify-token', isAuthenticated, (req, res) => {
  // Si on arrive ici, c'est que le middleware isAuthenticated a validé le token
  res.json({ valid: true, user: req.user });
});

// Check if email exists and get user ID
router.post('/check-email', (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email requis' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (user) {
      return res.json({ 
        exists: true, 
        userId: user.id,
        user: {
          nom: user.nom,
          prenom: user.prenom
        }
      });
    }
    
    res.json({ exists: false });
  } catch (error) {
    console.error('Erreur de vérification d\'email:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification de l\'email' });
  }
});

// Get user's temporary password without authentication
router.get('/user-temp-password', (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ message: 'Email requis' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Renvoyer uniquement si un mot de passe temporaire existe ou non
    res.json({ 
      passwordUnique: user.passwordUnique ? true : false 
    });
  } catch (error) {
    console.error('Erreur de récupération du mot de passe temporaire:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du mot de passe temporaire' });
  }
});

// Verify temporary password
router.post('/verify-temp-password', async (req, res) => {
  try {
    const { email, tempPassword } = req.body;
    
    if (!email || !tempPassword) {
      return res.status(400).json({ message: 'Email et mot de passe temporaire requis' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    let isValid = false;
    
    if (user.passwordUnique && user.passwordUnique.startsWith('$2')) {
      // Si le code temporaire est déjà hashé
      isValid = await bcrypt.compare(tempPassword, user.passwordUnique);
    } else {
      // Pour la rétrocompatibilité avec les codes non hashés
      isValid = (user.passwordUnique === tempPassword);
    }
    
    res.json({ valid: isValid });
  } catch (error) {
    console.error('Erreur de vérification du mot de passe temporaire:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification du mot de passe temporaire' });
  }
});

// Reset password with temporary password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, passwordUnique, newPassword } = req.body;
    
    if (!email || !passwordUnique || !newPassword) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (userIndex === -1) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    let isCodeValid = false;
    if (users[userIndex].passwordUnique.startsWith('$2')) {
      // Si le code est hashé
      isCodeValid = await bcrypt.compare(passwordUnique, users[userIndex].passwordUnique);
    } else {
      // Pour la rétrocompatibilité
      isCodeValid = (users[userIndex].passwordUnique === passwordUnique);
    }
    
    if (!isCodeValid) {
      return res.status(401).json({ message: 'Code temporaire invalide' });
    }
    
    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Mettre à jour le mot de passe et réinitialiser le passwordUnique
    users[userIndex].password = hashedPassword;
    users[userIndex].passwordUnique = "";
    
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    
    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('Erreur de réinitialisation du mot de passe:', error);
    res.status(500).json({ message: 'Erreur lors de la réinitialisation du mot de passe' });
  }
});

// Forgot password endpoint
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email requis' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (userIndex === -1) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Vérifier si un code temporaire existe déjà
    const hasPasswordUnique = !!users[userIndex].passwordUnique;
    
    res.json({ 
      message: 'Vérification réussie',
      hasPasswordUnique: hasPasswordUnique,
      userId: users[userIndex].id
    });
  } catch (error) {
    console.error('Erreur de demande de réinitialisation:', error);
    res.status(500).json({ message: 'Erreur lors de la demande de réinitialisation' });
  }
});

module.exports = router;
