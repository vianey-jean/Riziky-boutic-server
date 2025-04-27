
const fs = require('fs');
const path = require('path');

// Middleware pour vérifier si l'utilisateur est connecté
exports.isAuthenticated = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Accès non autorisé, veuillez vous connecter' });
  }
  
  // Dans un vrai projet, utilisez JWT pour valider le token
  // Ici nous simulons avec un système simple
  try {
    const userId = token;
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/users.json')));
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Utilisateur non trouvé' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

// Middleware pour vérifier si l'utilisateur est admin
exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  next();
};
