
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isAuthenticated, isAdmin } = require('../middlewares/auth');
const multer = require('multer');

const productsFilePath = path.join(__dirname, '../data/products.json');

// Configuration pour les uploads d'images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Obtenir tous les produits
router.get('/', (req, res) => {
  try {
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des produits' });
  }
});

// Obtenir un produit par ID
router.get('/:id', (req, res) => {
  try {
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const product = products.find(p => p.id === req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du produit' });
  }
});

// Obtenir les produits les plus favoris
router.get('/stats/most-favorited', (req, res) => {
  try {
    const favoritesPath = path.join(__dirname, '../data/favorites.json');
    const favoritesData = JSON.parse(fs.readFileSync(favoritesPath));
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    
    // Compter les favoris par produit
    const favoriteCountMap = {};
    favoritesData.forEach(fav => {
      if (favoriteCountMap[fav.productId]) {
        favoriteCountMap[fav.productId]++;
      } else {
        favoriteCountMap[fav.productId] = 1;
      }
    });
    
    // Transformer en tableau pour tri
    const sortedFavorites = Object.entries(favoriteCountMap)
      .map(([productId, count]) => ({ productId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4); // Top 4
    
    // Récupérer les détails des produits
    const topProducts = sortedFavorites.map(fav => 
      products.find(p => p.id === fav.productId)
    ).filter(Boolean); // Filtre les undefined si un produit n'existe plus
    
    res.json(topProducts);
  } catch (error) {
    console.error('Erreur lors de la récupération des produits favoris:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des produits favoris' });
  }
});

// Obtenir les nouveaux produits
router.get('/stats/new-arrivals', (req, res) => {
  try {
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    
    // Trier par date d'ajout (utiliser l'ID comme approximation si pas de champ dateAjout)
    const sortedProducts = [...products].sort((a, b) => {
      if (a.dateAjout && b.dateAjout) {
        return new Date(b.dateAjout) - new Date(a.dateAjout);
      } else {
        // Fallback sur l'ID si pas de date
        return b.id.localeCompare(a.id);
      }
    });
    
    const newArrivals = sortedProducts.slice(0, 10); // Top 10
    res.json(newArrivals);
  } catch (error) {
    console.error('Erreur lors de la récupération des nouveaux produits:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des nouveaux produits' });
  }
});

// Ajouter un nouveau produit (admin seulement)
router.post('/', isAuthenticated, isAdmin, upload.single('image'), (req, res) => {
  try {
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const newProduct = {
      id: `prod-${Date.now()}`,
      ...req.body,
      price: parseFloat(req.body.price),
      originalPrice: parseFloat(req.body.price),
      stock: parseInt(req.body.stock) || 0,
      isSold: (req.body.stock && parseInt(req.body.stock) > 0) || false,
      promotion: null,
      promotionEnd: null,
      dateAjout: new Date().toISOString(),
      image: req.file ? `/uploads/${req.file.filename}` : '/placeholder.svg'
    };
    
    products.push(newProduct);
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
    
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'ajout du produit' });
  }
});

// Mettre à jour un produit (admin seulement)
router.put('/:id', isAuthenticated, isAdmin, upload.single('image'), (req, res) => {
  try {
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const index = products.findIndex(p => p.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    const currentProduct = products[index];
    
    // Gérer les promotions
    let promotion = null;
    let promotionEnd = null;
    let price = parseFloat(req.body.price || currentProduct.price);
    const originalPrice = parseFloat(req.body.originalPrice || currentProduct.originalPrice || price);
    
    if (req.body.promotion) {
      promotion = parseInt(req.body.promotion);
      // Si nouvelle promotion, créer une date d'expiration à 24h
      promotionEnd = req.body.promotionEnd || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      // Calculer le prix réduit
      price = originalPrice * (1 - promotion / 100);
    }
    
    // Gestion du stock et de la disponibilité
    const stock = parseInt(req.body.stock !== undefined ? req.body.stock : currentProduct.stock);
    const isSold = stock > 0;
    
    const updatedProduct = {
      ...currentProduct,
      ...req.body,
      price: parseFloat(price.toFixed(2)),
      originalPrice: parseFloat(originalPrice.toFixed(2)),
      promotion: promotion,
      promotionEnd: promotionEnd,
      stock: stock,
      isSold: isSold,
      id: req.params.id
    };
    
    // Mettre à jour l'image si une nouvelle est fournie
    if (req.file) {
      updatedProduct.image = `/uploads/${req.file.filename}`;
    }
    
    products[index] = updatedProduct;
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
    
    res.json(updatedProduct);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du produit:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du produit' });
  }
});

// Mettre à jour le stock d'un produit après achat
router.put('/:id/update-stock', isAuthenticated, (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || isNaN(parseInt(quantity)) || parseInt(quantity) <= 0) {
      return res.status(400).json({ message: 'Quantité invalide' });
    }
    
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const index = products.findIndex(p => p.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    const product = products[index];
    
    if (!product.stock || product.stock < parseInt(quantity)) {
      return res.status(400).json({ message: 'Stock insuffisant' });
    }
    
    // Mettre à jour le stock
    product.stock -= parseInt(quantity);
    // Mettre à jour disponibilité
    product.isSold = product.stock > 0;
    
    products[index] = product;
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du stock' });
  }
});

// Supprimer un produit (admin seulement)
router.delete('/:id', isAuthenticated, isAdmin, (req, res) => {
  try {
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const filteredProducts = products.filter(p => p.id !== req.params.id);
    
    if (filteredProducts.length === products.length) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    fs.writeFileSync(productsFilePath, JSON.stringify(filteredProducts, null, 2));
    res.json({ message: 'Produit supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du produit' });
  }
});

module.exports = router;
