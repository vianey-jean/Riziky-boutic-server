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

// Récupérer tous les commentaires
router.get('/', checkFileExists, (req, res) => {
  try {
    const reviews = JSON.parse(fs.readFileSync(reviewsFilePath));
    res.json(reviews);
  } catch (error) {
    console.error('Erreur lors de la récupération des commentaires:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des commentaires' });
  }
});

// Récupérer les meilleurs commentaires (note élevée)
router.get('/best', checkFileExists, (req, res) => {
  try {
    const reviews = JSON.parse(fs.readFileSync(reviewsFilePath));
    
    // Trier les commentaires par note moyenne décroissante, puis par date
    const sortedReviews = [...reviews].sort((a, b) => {
      // Calculer la note moyenne pour chaque commentaire
      const avgRatingA = (a.productRating + a.deliveryRating) / 2;
      const avgRatingB = (b.productRating + b.deliveryRating) / 2;
      
      // D'abord par note
      if (avgRatingB !== avgRatingA) {
        return avgRatingB - avgRatingA;
      }
      
      // Ensuite par date (les plus récents d'abord)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    // Filtrer pour n'avoir que des commentaires avec du texte
    const filteredReviews = sortedReviews.filter(review => review.comment && review.comment.trim() !== '');
    
    // Prendre les 3 meilleurs
    const bestReviews = filteredReviews.slice(0, 3);
    
    res.json(bestReviews);
  } catch (error) {
    console.error('Erreur lors de la récupération des meilleurs commentaires:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des meilleurs commentaires' });
  }
});

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
      return res.status(400).json({ message: `Erreur de téléchargement: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ message: `Erreur: ${err.message}` });
    }
    
    try {
      const { productId, productRating, deliveryRating, comment, parentId } = req.body;
      
      if (!productId || comment === undefined) {
        return res.status(400).json({ message: 'Informations manquantes' });
      }
      
      // Pour les commentaires principaux, les notes sont requises
      if (!parentId && (productRating === undefined || deliveryRating === undefined)) {
        return res.status(400).json({ message: 'Les notes produit et livraison sont requises' });
      }
      
      const reviews = JSON.parse(fs.readFileSync(reviewsFilePath));
      
      // Traiter les photos téléchargées
      const photos = req.files ? req.files.map(file => {
        return '/uploads/review-photos/' + path.basename(file.path);
      }) : [];
      
      const reviewData = {
        id: Date.now().toString(),
        userId: req.user.id,
        userName: `${req.user.prenom || ''} ${req.user.nom}`.trim(),
        productId,
        productRating: parentId ? 0 : parseInt(productRating), // 0 pour les réponses
        deliveryRating: parentId ? 0 : parseInt(deliveryRating), // 0 pour les réponses
        comment: comment || '',
        photos: photos,
        parentId: parentId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      reviews.push(reviewData);
      fs.writeFileSync(reviewsFilePath, JSON.stringify(reviews, null, 2));
      res.status(201).json(reviewData);
    } catch (error) {
      console.error('Erreur lors de l\'ajout du commentaire:', error);
      res.status(500).json({ message: 'Erreur lors de l\'ajout du commentaire' });
    }
  });
});

// Ajouter une réponse à un commentaire
router.post('/:parentId/reply', isAuthenticated, checkFileExists, (req, res) => {
  upload(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Erreur de téléchargement: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ message: `Erreur: ${err.message}` });
    }
    
    try {
      const { parentId } = req.params;
      const { comment, productRating, deliveryRating } = req.body;
      
      if (!comment || comment.trim() === '') {
        return res.status(400).json({ message: 'Le commentaire est requis' });
      }
      
      if (!productRating || !deliveryRating) {
        return res.status(400).json({ message: 'Les notes produit et livraison sont requises' });
      }
      
      const reviews = JSON.parse(fs.readFileSync(reviewsFilePath));
      
      // Vérifier que le commentaire parent existe
      const parentReview = reviews.find(review => review.id === parentId);
      if (!parentReview) {
        return res.status(404).json({ message: 'Commentaire parent non trouvé' });
      }
      
      // Traiter les photos téléchargées
      const photos = req.files ? req.files.map(file => {
        return '/uploads/review-photos/' + path.basename(file.path);
      }) : [];
      
      const replyData = {
        id: Date.now().toString(),
        userId: req.user.id,
        userName: `${req.user.prenom || ''} ${req.user.nom}`.trim(),
        productId: parentReview.productId,
        productRating: parseInt(productRating),
        deliveryRating: parseInt(deliveryRating),
        comment: comment.trim(),
        photos: photos,
        parentId: parentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      reviews.push(replyData);
      fs.writeFileSync(reviewsFilePath, JSON.stringify(reviews, null, 2));
      res.status(201).json(replyData);
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la réponse:', error);
      res.status(500).json({ message: 'Erreur lors de l\'ajout de la réponse' });
    }
  });
});

// Modifier un commentaire (nécessite d'être authentifié)
router.put('/:reviewId', isAuthenticated, checkFileExists, (req, res) => {
  upload(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Erreur de téléchargement: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ message: `Erreur: ${err.message}` });
    }
    
    try {
      const { reviewId } = req.params;
      const { productRating, deliveryRating, comment } = req.body;
      
      const reviews = JSON.parse(fs.readFileSync(reviewsFilePath));
      const reviewIndex = reviews.findIndex(review => review.id === reviewId);
      
      if (reviewIndex === -1) {
        return res.status(404).json({ message: 'Commentaire non trouvé' });
      }
      
      // Vérifier que l'utilisateur est le propriétaire du commentaire
      if (reviews[reviewIndex].userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier ce commentaire' });
      }
      
      // Traiter les nouvelles photos téléchargées
      const newPhotos = req.files ? req.files.map(file => {
        return '/uploads/review-photos/' + path.basename(file.path);
      }) : [];
      
      // Garder les anciennes photos + ajouter les nouvelles (max 4 au total)
      const existingPhotos = reviews[reviewIndex].photos || [];
      const allPhotos = [...existingPhotos, ...newPhotos].slice(0, 4);
      
      // Mettre à jour le commentaire
      reviews[reviewIndex] = {
        ...reviews[reviewIndex],
        productRating: productRating ? parseInt(productRating) : reviews[reviewIndex].productRating,
        deliveryRating: deliveryRating ? parseInt(deliveryRating) : reviews[reviewIndex].deliveryRating,
        comment: comment !== undefined ? comment : reviews[reviewIndex].comment,
        photos: allPhotos,
        updatedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(reviewsFilePath, JSON.stringify(reviews, null, 2));
      res.json(reviews[reviewIndex]);
    } catch (error) {
      console.error('Erreur lors de la modification du commentaire:', error);
      res.status(500).json({ message: 'Erreur lors de la modification du commentaire' });
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
    
    // Supprimer les photos associées au commentaire principal
    if (reviews[reviewIndex].photos && reviews[reviewIndex].photos.length > 0) {
      reviews[reviewIndex].photos.forEach(photoPath => {
        const fullPath = path.join(__dirname, '..', photoPath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      });
    }
    
    // Trouver et supprimer toutes les réponses à ce commentaire
    const repliesToDelete = reviews.filter(review => review.parentId === reviewId);
    repliesToDelete.forEach(reply => {
      // Supprimer les photos des réponses
      if (reply.photos && reply.photos.length > 0) {
        reply.photos.forEach(photoPath => {
          const fullPath = path.join(__dirname, '..', photoPath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        });
      }
    });
    
    // Supprimer le commentaire principal et toutes ses réponses
    const updatedReviews = reviews.filter(review => 
      review.id !== reviewId && review.parentId !== reviewId
    );
    
    fs.writeFileSync(reviewsFilePath, JSON.stringify(updatedReviews, null, 2));
    
    res.json({ message: 'Commentaire et ses réponses supprimés avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du commentaire:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du commentaire' });
  }
});

// Ajouter/retirer un like d'un commentaire (nécessite d'être authentifié)
router.post('/:reviewId/like', isAuthenticated, checkFileExists, (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;
    
    const reviews = JSON.parse(fs.readFileSync(reviewsFilePath));
    const reviewIndex = reviews.findIndex(review => review.id === reviewId);
    
    if (reviewIndex === -1) {
      return res.status(404).json({ message: 'Commentaire non trouvé' });
    }
    
    // Initialiser les likes si elles n'existent pas
    if (!reviews[reviewIndex].likes) {
      reviews[reviewIndex].likes = [];
    }
    
    const userLikedIndex = reviews[reviewIndex].likes.indexOf(userId);
    
    if (userLikedIndex > -1) {
      // L'utilisateur a déjà liké, on retire le like
      reviews[reviewIndex].likes.splice(userLikedIndex, 1);
    } else {
      // L'utilisateur n'a pas encore liké, on ajoute le like
      reviews[reviewIndex].likes.push(userId);
    }
    
    // Mettre à jour le compteur
    reviews[reviewIndex].likesCount = reviews[reviewIndex].likes.length;
    reviews[reviewIndex].updatedAt = new Date().toISOString();
    
    fs.writeFileSync(reviewsFilePath, JSON.stringify(reviews, null, 2));
    
    res.json({
      reviewId,
      liked: userLikedIndex === -1,
      likesCount: reviews[reviewIndex].likesCount
    });
  } catch (error) {
    console.error('Erreur lors du toggle like:', error);
    res.status(500).json({ message: 'Erreur lors du toggle like' });
  }
});

// Récupérer les likes d'un commentaire
router.get('/:reviewId/likes', checkFileExists, (req, res) => {
  try {
    const { reviewId } = req.params;
    const reviews = JSON.parse(fs.readFileSync(reviewsFilePath));
    const review = reviews.find(review => review.id === reviewId);
    
    if (!review) {
      return res.status(404).json({ message: 'Commentaire non trouvé' });
    }
    
    res.json({
      likes: review.likes || [],
      likesCount: review.likesCount || review.likes?.length || 0
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des likes:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des likes' });
  }
});

module.exports = router;
