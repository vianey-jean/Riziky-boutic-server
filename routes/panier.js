
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../middlewares/auth');

const panierFilePath = path.join(__dirname, '../data/panier.json');
const productsFilePath = path.join(__dirname, '../data/products.json');

// Obtenir le panier d'un utilisateur
router.get('/:userId', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur demande son propre panier
    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const paniers = JSON.parse(fs.readFileSync(panierFilePath));
    const panier = paniers.find(p => p.userId === req.params.userId) || { userId: req.params.userId, items: [] };
    
    res.json(panier);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du panier' });
  }
});

// Ajouter un produit au panier
router.post('/:userId/add', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur modifie son propre panier
    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const { productId, quantity } = req.body;
    
    // Vérifier que le produit existe
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    // Ajouter au panier
    const paniers = JSON.parse(fs.readFileSync(panierFilePath));
    const panierIndex = paniers.findIndex(p => p.userId === req.params.userId);
    
    if (panierIndex === -1) {
      // Créer un nouveau panier
      paniers.push({
        userId: req.params.userId,
        items: [{ productId, quantity: parseInt(quantity) || 1, price: product.price }]
      });
    } else {
      // Mettre à jour le panier existant
      const itemIndex = paniers[panierIndex].items.findIndex(i => i.productId === productId);
      
      if (itemIndex === -1) {
        // Ajouter un nouvel item
        paniers[panierIndex].items.push({ 
          productId, 
          quantity: parseInt(quantity) || 1,
          price: product.price
        });
      } else {
        // Mettre à jour la quantité
        paniers[panierIndex].items[itemIndex].quantity += parseInt(quantity) || 1;
      }
    }
    
    fs.writeFileSync(panierFilePath, JSON.stringify(paniers, null, 2));
    
    const updatedPanier = paniers.find(p => p.userId === req.params.userId);
    res.json(updatedPanier);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'ajout au panier' });
  }
});

// Mettre à jour la quantité d'un produit dans le panier
router.put('/:userId/update', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur modifie son propre panier
    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const { productId, quantity } = req.body;
    
    const paniers = JSON.parse(fs.readFileSync(panierFilePath));
    const panierIndex = paniers.findIndex(p => p.userId === req.params.userId);
    
    if (panierIndex === -1) {
      return res.status(404).json({ message: 'Panier non trouvé' });
    }
    
    const itemIndex = paniers[panierIndex].items.findIndex(i => i.productId === productId);
    
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Produit non trouvé dans le panier' });
    }
    
    if (quantity <= 0) {
      // Supprimer l'item si la quantité est 0 ou moins
      paniers[panierIndex].items = paniers[panierIndex].items.filter(i => i.productId !== productId);
    } else {
      // Mettre à jour la quantité
      paniers[panierIndex].items[itemIndex].quantity = parseInt(quantity);
    }
    
    fs.writeFileSync(panierFilePath, JSON.stringify(paniers, null, 2));
    
    res.json(paniers[panierIndex]);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du panier' });
  }
});

// Supprimer un produit du panier
router.delete('/:userId/remove/:productId', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur modifie son propre panier
    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const paniers = JSON.parse(fs.readFileSync(panierFilePath));
    const panierIndex = paniers.findIndex(p => p.userId === req.params.userId);
    
    if (panierIndex === -1) {
      return res.status(404).json({ message: 'Panier non trouvé' });
    }
    
    paniers[panierIndex].items = paniers[panierIndex].items.filter(i => i.productId !== req.params.productId);
    
    fs.writeFileSync(panierFilePath, JSON.stringify(paniers, null, 2));
    
    res.json(paniers[panierIndex]);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du produit du panier' });
  }
});

// Vider le panier
router.delete('/:userId/clear', isAuthenticated, (req, res) => {
  try {
    // Vérifier que l'utilisateur modifie son propre panier
    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    const paniers = JSON.parse(fs.readFileSync(panierFilePath));
    const panierIndex = paniers.findIndex(p => p.userId === req.params.userId);
    
    if (panierIndex === -1) {
      return res.status(404).json({ message: 'Panier non trouvé' });
    }
    
    paniers[panierIndex].items = [];
    
    fs.writeFileSync(panierFilePath, JSON.stringify(paniers, null, 2));
    
    res.json(paniers[panierIndex]);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du vidage du panier' });
  }
});

module.exports = router;
