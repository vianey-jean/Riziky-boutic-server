
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const secretKey = 'your_jwt_secret'; // Devrait être dans une variable d'environnement





// Middleware pour vérifier si l'utilisateur est connecté
exports.isAuthenticated = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ message: 'Accès non autorisé, veuillez vous connecter' });
  }
  
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Format d\'autorisation invalide' });
  }
  
  const token = parts[1];
  
  try {
    // Vérifier le token JWT
    const decoded = jwt.verify(token, secretKey);
    
    // Récupérer l'utilisateur depuis la base de données
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/users.json')));
    const user = users.find(u => u.id === decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Ajouter les données de l'utilisateur à l'objet req pour une utilisation ultérieure
    req.user = user;
    next();
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
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
