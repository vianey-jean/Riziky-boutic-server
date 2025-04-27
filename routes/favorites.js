
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../middlewares/auth');

const favoritesFilePath = path.join(__dirname, '../data/favorites.json');
const productsFilePath = path.join(__dirname, '../data/products.json');

// Obtenir les favoris d'un utilisateur
router.get('/:userId', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur demande ses propres favoris
    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const favorites = JSON.parse(fs.readFileSync(favoritesFilePath));
    const userFavorites = favorites.find(f => f.userId === req.params.userId) || { userId: req.params.userId, items: [] };
    
    // Enrichir les favoris avec les détails des produits
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    userFavorites.items = userFavorites.items.map(itemId => {
      return products.find(p => p.id === itemId) || itemId;
    });
    
    res.json(userFavorites);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des favoris' });
  }
});

// Ajouter un produit aux favoris
router.post('/:userId/add', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur modifie ses propres favoris
    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const { productId } = req.body;
    
    // Vérifier que le produit existe
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    // Ajouter aux favoris
    const favorites = JSON.parse(fs.readFileSync(favoritesFilePath));
    const favoriteIndex = favorites.findIndex(f => f.userId === req.params.userId);
    
    if (favoriteIndex === -1) {
      // Créer une nouvelle liste de favoris
      favorites.push({
        userId: req.params.userId,
        items: [productId]
      });
    } else {
      // Mettre à jour la liste existante
      if (!favorites[favoriteIndex].items.includes(productId)) {
        favorites[favoriteIndex].items.push(productId);
      }
    }
    
    fs.writeFileSync(favoritesFilePath, JSON.stringify(favorites, null, 2));
    
    const updatedFavorites = favorites.find(f => f.userId === req.params.userId);
    // Enrichir les favoris avec les détails des produits pour la réponse
    updatedFavorites.items = updatedFavorites.items.map(itemId => {
      return products.find(p => p.id === itemId) || itemId;
    });
    
    res.json(updatedFavorites);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'ajout aux favoris' });
  }
});

// Supprimer un produit des favoris
router.delete('/:userId/remove/:productId', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur modifie ses propres favoris
    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const favorites = JSON.parse(fs.readFileSync(favoritesFilePath));
    const favoriteIndex = favorites.findIndex(f => f.userId === req.params.userId);
    
    if (favoriteIndex === -1) {
      return res.status(404).json({ message: 'Liste de favoris non trouvée' });
    }
    
    favorites[favoriteIndex].items = favorites[favoriteIndex].items.filter(id => id !== req.params.productId);
    
    fs.writeFileSync(favoritesFilePath, JSON.stringify(favorites, null, 2));
    
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    // Enrichir les favoris avec les détails des produits pour la réponse
    favorites[favoriteIndex].items = favorites[favoriteIndex].items.map(itemId => {
      return products.find(p => p.id === itemId) || itemId;
    });
    
    res.json(favorites[favoriteIndex]);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du produit des favoris' });
  }
});

module.exports = router;
