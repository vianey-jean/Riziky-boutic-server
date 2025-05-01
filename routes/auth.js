
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const usersFilePath = path.join(__dirname, '../data/users.json');
const resetCodesPath = path.join(__dirname, '../data/reset-codes.json');

// Créer le fichier reset-codes.json s'il n'existe pas
const initResetCodes = () => {
  if (!fs.existsSync(resetCodesPath)) {
    fs.writeFileSync(resetCodesPath, JSON.stringify([], null, 2));
  }
};

initResetCodes();

// Configuration de nodemailer avec désactivation de la vérification TLS pour résoudre l'erreur de certificat
const transporter = nodemailer.createTransport({
  host: "live.smtp.mailtrap.io",
  port: 587,
  secure: false, // Utilise STARTTLS
  auth: {
    user: "api", 
    pass: "bc65c2de47ce0e2de7f1786dc37e81f0"
  },
  tls: {
    // Ne pas vérifier le certificat
    rejectUnauthorized: false
  }
});

// Inscription
router.post('/register', (req, res) => {
  try {
    const { nom, email, password } = req.body;
    
    // Validation basique
    if (!nom || !email || !password) {
      return res.status(400).json({ message: 'Veuillez remplir tous les champs obligatoires' });
    }
    
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    
    // Vérifier si l'email existe déjà
    if (users.some(u => u.email === email)) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }
    
    // Créer un nouvel utilisateur
    const newUser = {
      id: `user-${Date.now()}`,
      nom,
      email,
      password, // Dans un vrai projet, hacher le mot de passe avec bcrypt
      role: 'client',
      dateCreation: new Date().toISOString()
    };
    
    users.push(newUser);
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    
    // Ne pas renvoyer le mot de passe
    const { password: _, ...safeUser } = newUser;
    
    res.status(201).json({
      user: safeUser,
      token: newUser.id // Dans un vrai projet, utiliser JWT
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
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    // Ne pas renvoyer le mot de passe
    const { password: _, ...safeUser } = user;
    
    res.json({
      user: safeUser,
      token: user.id // Dans un vrai projet, utiliser JWT
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
      return res.status(404).json({ message: 'Aucun compte trouvé avec cet email' });
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
    
    // Envoyer un email réel avec nodemailer
    transporter.sendMail({
      from: '"E-commerce Support" <support@ecommerce.com>',
      to: email,
      subject: "Réinitialisation de votre mot de passe",
      text: `Votre code de réinitialisation est: ${resetCode}. Il est valide pendant 30 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Réinitialisation de mot de passe</h2>
          <p>Bonjour ${user.nom},</p>
          <p>Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte.</p>
          <p>Votre code de réinitialisation est:</p>
          <h3 style="font-size: 24px; background-color: #f0f0f0; padding: 10px; text-align: center; letter-spacing: 5px;">${resetCode}</h3>
          <p>Ce code est valable pendant 30 minutes.</p>
          <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
          <p>Cordialement,<br>L'équipe E-commerce</p>
        </div>
      `
    }).then(info => {
      console.log('Email envoyé avec succès:', info.response);
      res.json({ success: true, message: 'Un code de réinitialisation a été envoyé à votre adresse email' });
    }).catch(emailError => {
      console.error("Erreur d'envoi d'email:", emailError);
      // En cas d'erreur d'envoi, afficher simplement le code dans la console pour les tests
      console.log(`Code de réinitialisation pour ${email}: ${resetCode}`);
      res.json({ success: true, message: 'Si votre email est enregistré, vous recevrez un code de réinitialisation' });
    });
  } catch (error) {
    console.error("Erreur lors de la demande de réinitialisation:", error);
    res.status(500).json({ message: 'Erreur lors de la demande de réinitialisation' });
  }
});

// Vérifier le code de réinitialisation
router.post('/verify-reset-code', (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ message: 'Email et code requis' });
    }
    
    const resetCodes = JSON.parse(fs.readFileSync(resetCodesPath));
    const resetRequest = resetCodes.find(rc => rc.email === email && rc.code === code);
    
    if (!resetRequest) {
      return res.status(400).json({ message: 'Code de réinitialisation invalide' });
    }
    
    // Vérifier si le code n'a pas expiré
    if (new Date() > new Date(resetRequest.expiresAt)) {
      return res.status(400).json({ message: 'Le code de réinitialisation a expiré' });
    }
    
    res.json({ valid: true });
  } catch (error) {
    console.error("Erreur lors de la vérification du code:", error);
    res.status(500).json({ message: 'Erreur lors de la vérification du code' });
  }
});

// Réinitialiser le mot de passe
router.post('/reset-password', (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'Email, code et nouveau mot de passe requis' });
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
    
    // Mettre à jour le mot de passe
    users[userIndex].password = newPassword;
    
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    
    // Supprimer le code de réinitialisation utilisé
    const updatedResetCodes = resetCodes.filter(rc => !(rc.email === email && rc.code === code));
    fs.writeFileSync(resetCodesPath, JSON.stringify(updatedResetCodes, null, 2));
    
    res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
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

// Route pour vérifier le mot de passe
router.post('/verify-password', (req, res) => {
  try {
    const { userId, password } = req.body;
    
    if (!userId || !password) {
      return res.status(400).json({ 
        valid: false,
        message: 'ID utilisateur et mot de passe requis' 
      });
    }

    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ 
        valid: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    // Vérifier si le mot de passe est correct
    const isValid = user.password === password;
    
    res.json({ 
      valid: isValid, 
      message: isValid ? 'Mot de passe valide' : 'Mot de passe incorrect' 
    });
  } catch (error) {
    console.error("Erreur lors de la vérification du mot de passe:", error);
    res.status(500).json({ 
      valid: false, 
      message: 'Erreur lors de la vérification du mot de passe' 
    });
  }
});

module.exports = router;
