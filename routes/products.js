
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { isAuthenticated, isAdmin } = require('../middlewares/auth');

// Configuration pour l'upload d'images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Limite de 5MB
});

const productsFilePath = path.join(__dirname, '../data/products.json');
const favoritesFilePath = path.join(__dirname, '../data/favorites.json');

// Middleware pour vérifier si le fichier existe
const checkFileExists = (req, res, next) => {
  if (!fs.existsSync(productsFilePath)) {
    fs.writeFileSync(productsFilePath, JSON.stringify([]));
  }
  next();
};

// Obtenir tous les produits
router.get('/', checkFileExists, (req, res) => {
  try {
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des produits' });
  }
});

// Obtenir les produits par catégorie
router.get('/category/:categoryName', checkFileExists, (req, res) => {
  try {
    const { categoryName } = req.params;
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const filteredProducts = products.filter(
      product => product.category.toLowerCase() === categoryName.toLowerCase()
    );
    res.json(filteredProducts);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des produits par catégorie' });
  }
});

// Rechercher des produits
router.get('/search', checkFileExists, (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 3) {
      return res.json([]);
    }
    
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const searchResults = products.filter(product => 
      product.name.toLowerCase().includes(q.toLowerCase()) ||
      product.description.toLowerCase().includes(q.toLowerCase()) ||
      product.category.toLowerCase().includes(q.toLowerCase())
    );
    
    res.json(searchResults);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la recherche des produits' });
  }
});

// Obtenir les produits les plus favorisés
router.get('/stats/most-favorited', checkFileExists, (req, res) => {
  try {
    if (!fs.existsSync(favoritesFilePath)) {
      return res.json([]);
    }
    
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const favorites = JSON.parse(fs.readFileSync(favoritesFilePath));
    
    // Compter le nombre de fois que chaque produit est dans les favoris
    const productCounts = {};
    favorites.forEach(fav => {
      const productId = fav.productId;
      if (productId) {
        productCounts[productId] = (productCounts[productId] || 0) + 1;
      }
    });
    
    // Trier les produits par nombre de favoris
    const sortedProducts = products
      .filter(product => productCounts[product.id])
      .sort((a, b) => (productCounts[b.id] || 0) - (productCounts[a.id] || 0))
      .slice(0, 8); // Limiter à 8 produits
    
    res.json(sortedProducts);
  } catch (error) {
    console.error('Erreur lors de la récupération des produits favoris:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des produits favoris' });
  }
});

// Obtenir les nouveaux produits
router.get('/stats/new-arrivals', checkFileExists, (req, res) => {
  try {
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    
    // Trier par date d'ajout décroissante
    const newArrivals = [...products]
      .sort((a, b) => {
        const dateA = a.dateAjout ? new Date(a.dateAjout).getTime() : 0;
        const dateB = b.dateAjout ? new Date(b.dateAjout).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10); // Limiter à 10 produits
    
    res.json(newArrivals);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des nouveaux produits' });
  }
});

// Obtenir un produit par ID
router.get('/:id', checkFileExists, (req, res) => {
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

// Créer un nouveau produit (admin seulement)
router.post('/', isAuthenticated, isAdmin, upload.single('image'), checkFileExists, (req, res) => {
  try {
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    
    const newProduct = {
      id: Date.now().toString(),
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      originalPrice: parseFloat(req.body.price),
      category: req.body.category,
      image: req.file ? `/uploads/${req.file.filename}` : '/placeholder.svg',
      promotion: req.body.promotion ? parseInt(req.body.promotion) : null,
      promotionEnd: req.body.promotionEnd || null,
      stock: parseInt(req.body.stock) || 0,
      isSold: (parseInt(req.body.stock) || 0) > 0,
      dateAjout: new Date().toISOString(),
    };
    
    products.push(newProduct);
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
    
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du produit' });
  }
});

// Mettre à jour un produit (admin seulement)
router.put('/:id', isAuthenticated, isAdmin, upload.single('image'), checkFileExists, (req, res) => {
  try {
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const index = products.findIndex(p => p.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    const updatedProduct = {
      ...products[index],
      name: req.body.name || products[index].name,
      description: req.body.description || products[index].description,
      price: req.body.price ? parseFloat(req.body.price) : products[index].price,
      category: req.body.category || products[index].category,
      promotion: req.body.promotion !== undefined ? parseInt(req.body.promotion) : products[index].promotion,
      promotionEnd: req.body.promotionEnd || products[index].promotionEnd,
      stock: req.body.stock !== undefined ? parseInt(req.body.stock) : products[index].stock,
      isSold: req.body.stock !== undefined ? parseInt(req.body.stock) > 0 : products[index].isSold,
    };
    
    if (req.file) {
      // Si une nouvelle image est uploadée, mettre à jour le chemin
      updatedProduct.image = `/uploads/${req.file.filename}`;
    }
    
    products[index] = updatedProduct;
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
    
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du produit' });
  }
});

// Supprimer un produit (admin seulement)
router.delete('/:id', isAuthenticated, isAdmin, checkFileExists, (req, res) => {
  try {
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const initialLength = products.length;
    const filteredProducts = products.filter(p => p.id !== req.params.id);
    
    if (filteredProducts.length === initialLength) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    fs.writeFileSync(productsFilePath, JSON.stringify(filteredProducts, null, 2));
    res.json({ message: 'Produit supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du produit' });
  }
});

// Appliquer une promotion à un produit (admin seulement)
router.post('/:id/promotion', isAuthenticated, isAdmin, checkFileExists, (req, res) => {
  try {
    const { promotion, duration } = req.body;
    if (promotion === undefined || !duration) {
      return res.status(400).json({ message: 'Promotion et durée requises' });
    }
    
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const index = products.findIndex(p => p.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    // Calculer la date de fin de promotion
    const promotionEnd = new Date();
    promotionEnd.setDate(promotionEnd.getDate() + parseInt(duration));
    
    // Sauvegarder le prix original avant la promotion
    const originalPrice = products[index].originalPrice || products[index].price;
    
    // Appliquer la promotion
    const discountFactor = 1 - (parseInt(promotion) / 100);
    const discountedPrice = originalPrice * discountFactor;
    
    products[index] = {
      ...products[index],
      originalPrice,
      price: Math.round(discountedPrice * 100) / 100, // Arrondir à 2 décimales
      promotion: parseInt(promotion),
      promotionEnd: promotionEnd.toISOString()
    };
    
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
    
    res.json(products[index]);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'application de la promotion' });
  }
});

module.exports = router;
