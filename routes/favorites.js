
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
    const userFavorites = favorites.filter(f => f.userId === req.params.userId);
    
    if (!userFavorites || userFavorites.length === 0) {
      return res.json({ userId: req.params.userId, items: [] });
    }
    
    // Enrichir les favoris avec les détails des produits
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const favoriteProducts = [];
    
    for (const favorite of userFavorites) {
      const product = products.find(p => p.id === favorite.productId);
      if (product) {
        favoriteProducts.push(product);
      }
    }
    
    res.json({ userId: req.params.userId, items: favoriteProducts });
  } catch (error) {
    console.error('Erreur lors de la récupération des favoris:', error);
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
    
    if (!productId) {
      return res.status(400).json({ message: 'ID de produit requis' });
    }
    
    // Vérifier que le produit existe
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    // Ajouter aux favoris
    const favorites = JSON.parse(fs.readFileSync(favoritesFilePath));
    
    // Vérifier si le favori existe déjà
    const existingFavorite = favorites.find(
      f => f.userId === req.params.userId && f.productId === productId
    );
    
    if (existingFavorite) {
      // Le favori existe déjà
      return res.status(400).json({ message: 'Ce produit est déjà dans vos favoris' });
    }
    
    const newFavorite = {
      id: `fav-${Date.now()}`,
      userId: req.params.userId,
      productId: productId
    };
    
    favorites.push(newFavorite);
    fs.writeFileSync(favoritesFilePath, JSON.stringify(favorites, null, 2));
    
    // Récupérer tous les favoris de l'utilisateur
    const userFavorites = favorites.filter(f => f.userId === req.params.userId);
    
    // Enrichir la réponse avec les détails des produits
    const favoriteProducts = [];
    for (const fav of userFavorites) {
      const p = products.find(p => p.id === fav.productId);
      if (p) {
        favoriteProducts.push(p);
      }
    }
    
    res.json({ 
      userId: req.params.userId, 
      items: favoriteProducts 
    });
  } catch (error) {
    console.error('Erreur lors de l\'ajout aux favoris:', error);
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
    
    // Filtrer pour supprimer le favori spécifique
    const updatedFavorites = favorites.filter(
      f => !(f.userId === req.params.userId && f.productId === req.params.productId)
    );
    
    if (updatedFavorites.length === favorites.length) {
      return res.status(404).json({ message: 'Favori non trouvé' });
    }
    
    fs.writeFileSync(favoritesFilePath, JSON.stringify(updatedFavorites, null, 2));
    
    // Récupérer tous les favoris restants de l'utilisateur
    const userFavorites = updatedFavorites.filter(f => f.userId === req.params.userId);
    
    // Enrichir la réponse avec les détails des produits
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const favoriteProducts = [];
    
    for (const fav of userFavorites) {
      const product = products.find(p => p.id === fav.productId);
      if (product) {
        favoriteProducts.push(product);
      }
    }
    
    res.json({ 
      userId: req.params.userId, 
      items: favoriteProducts 
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du favori:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du favori' });
  }
});

module.exports = router;
