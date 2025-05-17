
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../middlewares/auth');
const multer = require('multer');

const reviewsFilePath = path.join(__dirname, '../data/reviews.json');

// Configuration de multer pour le stockage des images de commentaires
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/review-photos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'review-photo-' + uniqueSuffix + extension);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers images sont autorisés!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // limite à 5MB
  }
}).array('photos', 4); // Maximum 4 photos par commentaire

// Middleware pour vérifier si le fichier existe
const checkFileExists = (req, res, next) => {
  if (!fs.existsSync(reviewsFilePath)) {
    fs.writeFileSync(reviewsFilePath, JSON.stringify([]));
  }
  next();
};

// Récupérer tous les commentaires d'un produit
router.get('/product/:productId', checkFileExists, (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = JSON.parse(fs.readFileSync(reviewsFilePath));
    const productReviews = reviews.filter(review => review.productId === productId);
    
    res.json(productReviews);
  } catch (error) {
    console.error('Erreur lors de la récupération des commentaires:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des commentaires' });
  }
});

// Récupérer un commentaire spécifique
router.get('/:reviewId', checkFileExists, (req, res) => {
  try {
    const { reviewId } = req.params;
    const reviews = JSON.parse(fs.readFileSync(reviewsFilePath));
    const review = reviews.find(review => review.id === reviewId);
    
    if (!review) {
      return res.status(404).json({ message: 'Commentaire non trouvé' });
    }
    
    res.json(review);
  } catch (error) {
    console.error('Erreur lors de la récupération du commentaire:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du commentaire' });
  }
});

// Ajouter un nouveau commentaire (nécessite d'être authentifié)
router.post('/', isAuthenticated, checkFileExists, (req, res) => {
  upload(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      // Une erreur Multer s'est produite lors du téléchargement
      return res.status(400).json({ message: `Erreur de téléchargement: ${err.message}` });
    } else if (err) {
      // Une erreur inconnue s'est produite
      return res.status(500).json({ message: `Erreur: ${err.message}` });
    }
    
    try {
      const { productId, productRating, deliveryRating, comment } = req.body;
      
      if (!productId || productRating === undefined || deliveryRating === undefined) {
        return res.status(400).json({ message: 'Informations manquantes' });
      }
      
      const reviews = JSON.parse(fs.readFileSync(reviewsFilePath));
      
      // Vérifier si l'utilisateur a déjà commenté ce produit
      const existingReviewIndex = reviews.findIndex(
        review => review.productId === productId && review.userId === req.user.id
      );
      
      // Traiter les photos téléchargées
      const photos = req.files ? req.files.map(file => {
        // Stocker uniquement le chemin relatif pour être cohérent avec les autres images
        return '/uploads/review-photos/' + path.basename(file.path);
      }) : [];
      
      const reviewData = {
        id: existingReviewIndex >= 0 ? reviews[existingReviewIndex].id : Date.now().toString(),
        userId: req.user.id,
        userName: `${req.user.prenom || ''} ${req.user.nom}`.trim(),
        productId,
        productRating: parseInt(productRating),
        deliveryRating: parseInt(deliveryRating),
        comment: comment || '',
        photos: existingReviewIndex >= 0 
          ? [...(reviews[existingReviewIndex].photos || []), ...photos].slice(0, 4)
          : photos,
        createdAt: existingReviewIndex >= 0 ? reviews[existingReviewIndex].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      if (existingReviewIndex >= 0) {
        reviews[existingReviewIndex] = reviewData;
      } else {
        reviews.push(reviewData);
      }
      
      fs.writeFileSync(reviewsFilePath, JSON.stringify(reviews, null, 2));
      res.status(201).json(reviewData);
    } catch (error) {
      console.error('Erreur lors de l\'ajout du commentaire:', error);
      res.status(500).json({ message: 'Erreur lors de l\'ajout du commentaire' });
    }
  });
});

// Supprimer un commentaire (nécessite d'être authentifié)
router.delete('/:reviewId', isAuthenticated, checkFileExists, (req, res) => {
  try {
    const { reviewId } = req.params;
    const reviews = JSON.parse(fs.readFileSync(reviewsFilePath));
    
    const reviewIndex = reviews.findIndex(review => review.id === reviewId);
    
    if (reviewIndex === -1) {
      return res.status(404).json({ message: 'Commentaire non trouvé' });
    }
    
    // Vérifier que l'utilisateur est le propriétaire du commentaire ou un admin
    if (reviews[reviewIndex].userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à supprimer ce commentaire' });
    }
    
    // Supprimer les photos associées au commentaire
    if (reviews[reviewIndex].photos && reviews[reviewIndex].photos.length > 0) {
      reviews[reviewIndex].photos.forEach(photoPath => {
        const fullPath = path.join(__dirname, '..', photoPath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      });
    }
    
    reviews.splice(reviewIndex, 1);
    fs.writeFileSync(reviewsFilePath, JSON.stringify(reviews, null, 2));
    
    res.json({ message: 'Commentaire supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du commentaire:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du commentaire' });
  }
});

module.exports = router;
