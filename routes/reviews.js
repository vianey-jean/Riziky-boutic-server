
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../middlewares/auth');

const reviewsFilePath = path.join(__dirname, '../data/reviews.json');

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

// Ajouter un nouveau commentaire (nécessite d'être authentifié)
router.post('/', isAuthenticated, checkFileExists, (req, res) => {
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
    
    const reviewData = {
      id: existingReviewIndex >= 0 ? reviews[existingReviewIndex].id : Date.now().toString(),
      userId: req.user.id,
      userName: `${req.user.prenom || ''} ${req.user.nom}`.trim(),
      productId,
      productRating,
      deliveryRating,
      comment: comment || '',
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
    
    reviews.splice(reviewIndex, 1);
    fs.writeFileSync(reviewsFilePath, JSON.stringify(reviews, null, 2));
    
    res.json({ message: 'Commentaire supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du commentaire:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du commentaire' });
  }
});

module.exports = router;
