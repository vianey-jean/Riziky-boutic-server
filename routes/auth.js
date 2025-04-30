const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const usersFilePath = path.join(__dirname, '../data/users.json');
const resetCodesPath = path.join(__dirname, '../data/reset-codes.json');

// Créer le fichier reset-codes.json s'il n'existe pas
const initResetCodes = () => {
  if (!fs.existsSync(resetCodesPath)) {
    fs.writeFileSync(resetCodesPath, JSON.stringify([], null, 2));
  }
};

initResetCodes();

// Fonction de cryptage du mot de passe
const encryptPassword = (password) => {
  const salt = "RIZIKY_SALT_SECRET"; // Devrait être stocké en variable d'environnement
  return Buffer.from(`${salt}:${password}`).toString('base64');
};

// Fonction de décryptage du mot de passe
const decryptPassword = (encryptedPassword) => {
  const decoded = Buffer.from(encryptedPassword, 'base64').toString('utf-8');
  const salt = "RIZIKY_SALT_SECRET";
  return decoded.substring(salt.length + 1);
};

// Fonction de vérification de mot de passe
const verifyPassword = (password, encryptedPassword) => {
  const decryptedPassword = decryptPassword(encryptedPassword);
  return password === decryptedPassword;
};

// Inscription
router.post('/register', (req, res) => {
  try {
    const { nom, email, password } = req.body;
    
    // Validation basique
    if (!nom || !email || !password) {
      return res.status(400).json({ message: 'Veuillez remplir tous les champs obligatoires' });
    }
    
    // Validation de la complexité du mot de passe
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
    const isLongEnough = password.length >= 8;
    
    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar || !isLongEnough) {
      return res.status(400).json({
        message: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial'
      });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    
    // Vérifier si l'email existe déjà
    if (users.some(u => u.email === email)) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }
    
    // Crypter le mot de passe
    const encryptedPassword = encryptPassword(password);
    
    // Créer un nouvel utilisateur
    const newUser = {
      id: `user-${Date.now()}`,
      nom,
      email,
      password: encryptedPassword, // Mot de passe crypté
      role: 'client',
      dateCreation: new Date().toISOString()
    };
    
    users.push(newUser);
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    
    // Ne pas renvoyer le mot de passe
    const { password: _, ...safeUser } = newUser;
    
    res.status(201).json({
      user: safeUser,
      token: newUser.id
    });
  } catch (error) {
    console.error("Erreur lors de l'inscription:", error);
    res.status(500).json({ message: 'Erreur lors de l\'inscription' });
  }
});

// Connexion
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    // Vérifier le mot de passe
    const isPasswordValid = verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    // Ne pas renvoyer le mot de passe
    const { password: _, ...safeUser } = user;
    
    res.json({
      user: safeUser,
      token: user.id
    });
  } catch (error) {
    console.error("Erreur lors de la connexion:", error);
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
});

// Mot de passe oublié
router.post('/forgot-password', (req, res) => {
  try {
    const { email } = req.body;
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const user = users.find(u => u.email === email);
    
    if (!user) {
      // Pour des raisons de sécurité, ne pas révéler si l'email existe ou non
      return res.json({ message: 'Si votre email est enregistré, vous recevrez un code de réinitialisation' });
    }
    
    // Générer un code de réinitialisation à 6 chiffres
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Enregistrer le code avec une expiration (30 minutes)
    const resetCodes = JSON.parse(fs.readFileSync(resetCodesPath));
    
    // Supprimer les anciens codes pour cet utilisateur
    const filteredResetCodes = resetCodes.filter(rc => rc.email !== email);
    
    // Ajouter le nouveau code
    filteredResetCodes.push({
      email,
      code: resetCode,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
    });
    
    fs.writeFileSync(resetCodesPath, JSON.stringify(filteredResetCodes, null, 2));
    
    // Dans un vrai projet, envoyer un email réel avec nodemailer
    // Simuler l'envoi d'email
    console.log(`Code de réinitialisation pour ${email}: ${resetCode}`);
    
    res.json({ message: 'Si votre email est enregistré, vous recevrez un code de réinitialisation' });
  } catch (error) {
    console.error("Erreur lors de la demande de réinitialisation:", error);
    res.status(500).json({ message: 'Erreur lors de la demande de réinitialisation' });
  }
});

// Réinitialiser le mot de passe
router.post('/reset-password', (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    
    // Validation de la complexité du mot de passe
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(newPassword);
    const isLongEnough = newPassword.length >= 8;
    
    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar || !isLongEnough) {
      return res.status(400).json({
        message: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial'
      });
    }
    
    // Vérifier le code de réinitialisation
    const resetCodes = JSON.parse(fs.readFileSync(resetCodesPath));
    const resetRequest = resetCodes.find(rc => rc.email === email && rc.code === code);
    
    if (!resetRequest) {
      return res.status(400).json({ message: 'Code de réinitialisation invalide' });
    }
    
    // Vérifier si le code n'a pas expiré
    if (new Date() > new Date(resetRequest.expiresAt)) {
      return res.status(400).json({ message: 'Le code de réinitialisation a expiré' });
    }
    
    // Mettre à jour le mot de passe
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const userIndex = users.findIndex(u => u.email === email);
    
    if (userIndex === -1) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Crypter et mettre à jour le mot de passe
    users[userIndex].password = encryptPassword(newPassword);
    
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    
    // Supprimer le code de réinitialisation utilisé
    const updatedResetCodes = resetCodes.filter(rc => !(rc.email === email && rc.code === code));
    fs.writeFileSync(resetCodesPath, JSON.stringify(updatedResetCodes, null, 2));
    
    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error("Erreur lors de la réinitialisation du mot de passe:", error);
    res.status(500).json({ message: 'Erreur lors de la réinitialisation du mot de passe' });
  }
});

// Vérifier si le token est valide
router.get('/verify-token', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ valid: false });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const user = users.find(u => u.id === token);
    
    if (!user) {
      return res.status(401).json({ valid: false });
    }
    
    // Ne pas renvoyer le mot de passe
    const { password: _, ...safeUser } = user;
    
    res.json({
      valid: true,
      user: safeUser
    });
  } catch (error) {
    console.error("Erreur lors de la vérification du token:", error);
    res.status(500).json({ valid: false });
  }
});

// Vérifier le mot de passe
router.post('/verify-password', (req, res) => {
  try {
    const { userId, password } = req.body;
    
    if (!userId || !password) {
      return res.status(400).json({ message: 'UserId et mot de passe requis' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Vérifier le mot de passe
    const isPasswordValid = verifyPassword(password, user.password);
    
    res.json({ valid: isPasswordValid });
  } catch (error) {
    console.error("Erreur lors de la vérification du mot de passe:", error);
    res.status(500).json({ message: 'Erreur lors de la vérification du mot de passe' });
  }
});

// Check if email exists
router.post('/check-email', (req, res) => {
  try {
    const { email } = req.body;
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const user = users.find(u => u.email === email);
    
    if (user) {
      const { password, ...safeUser } = user;
      res.json({ exists: true, user: safeUser });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error("Erreur lors de la vérification de l'email:", error);
    res.status(500).json({ message: 'Erreur lors de la vérification de l\'email' });
  }
});

module.exports = router;
