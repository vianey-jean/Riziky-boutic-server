
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const secretKey = 'your_jwt_secret'; // Devrait être dans une variable d'environnement

// Middleware pour vérifier si l'utilisateur est connecté
exports.isAuthenticated = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  console.log('🔍 Vérification d\'authentification...');
  console.log('Headers d\'autorisation:', authHeader);
  
  if (!authHeader) {
    console.log('❌ Aucun header d\'autorisation');
    return res.status(401).json({ message: 'Accès non autorisé, veuillez vous connecter' });
  }
  
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.log('❌ Format d\'autorisation invalide');
    return res.status(401).json({ message: 'Format d\'autorisation invalide' });
  }
  
  const token = parts[1];
  console.log('🔑 Token reçu:', token ? 'Présent' : 'Absent');
  
  try {
    // Vérifier le token JWT
    const decoded = jwt.verify(token, secretKey);
    console.log('✅ Token décodé:', decoded);
    
    // Récupérer l'utilisateur depuis la base de données
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/users.json')));
    const user = users.find(u => u.id === decoded.id);
    
    if (!user) {
      console.log('❌ Utilisateur non trouvé pour l\'ID:', decoded.id);
      return res.status(401).json({ message: 'Utilisateur non trouvé' });
    }
    
    console.log('✅ Utilisateur authentifié:', user.email);
    // Ajouter les données de l'utilisateur à l'objet req pour une utilisation ultérieure
    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Erreur d\'authentification:', error.message);
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }
};

// Middleware pour vérifier si l'utilisateur est admin
exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  next();
};
