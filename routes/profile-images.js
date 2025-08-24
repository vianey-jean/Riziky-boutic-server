const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { isAuthenticated } = require('../middlewares/auth');

const usersFilePath = path.join(__dirname, '../data/users.json');
const uploadsDir = path.join(__dirname, '../uploads/profile-images');

// S'assurer que le dossier uploads existe
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuration multer pour l'upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile-${req.params.userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Vérifier que c'est bien une image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

// Upload d'une nouvelle photo de profil
router.post('/:userId/upload', isAuthenticated, upload.single('profileImage'), (req, res) => {
  try {
    console.log('📸 Upload de photo de profil pour utilisateur:', req.params.userId);
    console.log('📎 Fichier reçu:', req.file);

    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    // Vérifier que l'utilisateur modifie sa propre photo ou est admin
    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    const profileImagePath = `/uploads/profile-images/${req.file.filename}`;

    // Mettre à jour l'utilisateur dans la base de données avec la NOUVELLE photo comme active
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const userIndex = users.findIndex(u => u.id === req.params.userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // ✅ Définir la nouvelle photo uploadée comme photo active
    users[userIndex].profileImage = profileImagePath;
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

    console.log('✅ Nouvelle photo de profil définie comme active:', profileImagePath);

    res.json({ 
      message: 'Photo de profil ajoutée et définie comme active',
      profileImage: profileImagePath
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'upload:', error);
    res.status(500).json({ message: 'Erreur lors de l\'upload de la photo: ' + error.message });
  }
});

// Récupérer les photos existantes d'un utilisateur
router.get('/:userId/list', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur accède à ses propres photos ou est admin
    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Lister tous les fichiers de profil de cet utilisateur dans le dossier uploads
    const files = fs.readdirSync(uploadsDir);
    const profileImages = files
      .filter(file => file.startsWith(`profile-${req.params.userId}-`))
      .map(file => `/uploads/profile-images/${file}`)
      .sort((a, b) => b.localeCompare(a)); // Trier par nom décroissant (plus récent en premier)

    res.json(profileImages);
  } catch (error) {
    console.error('Erreur lors de la récupération des photos:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des photos' });
  }
});

// Définir une photo existante comme photo de profil active
router.put('/:userId/set-active', isAuthenticated, (req, res) => {
  try {
    const { profileImagePath } = req.body;
    
    if (!profileImagePath) {
      return res.status(400).json({ message: 'Chemin de l\'image requis' });
    }

    // Vérifier que l'utilisateur modifie sa propre photo ou est admin
    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Vérifier que le fichier existe
    const filePath = path.join(__dirname, '..', profileImagePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Fichier image non trouvé' });
    }

    // Mettre à jour l'utilisateur dans la base de données avec la photo SÉLECTIONNÉE comme active
    const users = JSON.parse(fs.readFileSync(usersFilePath));
    const userIndex = users.findIndex(u => u.id === req.params.userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // ✅ Définir la photo sélectionnée comme photo active
    users[userIndex].profileImage = profileImagePath;
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

    console.log('✅ Photo sélectionnée définie comme active:', profileImagePath);

    res.json({ 
      message: 'Photo de profil active mise à jour',
      profileImage: profileImagePath
    });
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la photo: ' + error.message });
  }
});

module.exports = router;
