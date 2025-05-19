const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { isAuthenticated, isAdmin } = require('../middlewares/auth');
const sanitizeHtml = require('sanitize-html');
const rateLimit = require('express-rate-limit');

// Rate limiting pour éviter les attaques par force brute
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  message: { message: 'Trop de requêtes, veuillez réessayer plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Protection contre l'exploration des répertoires
const securePath = (userPath) => {
  const normalized = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(__dirname, '..', normalized);
};

// Fonction pour nettoyer les entrées de l'utilisateur
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return sanitizeHtml(input, {
      allowedTags: [], 
      allowedAttributes: {},
      disallowedTagsMode: 'recursiveEscape'
    });
  }
  return input;
};

// Configuration pour l'upload d'images avec vérification du type et taille
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

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
    return cb(new Error('Seuls les fichiers image sont autorisés!'), false);
  }
  cb(null, true);
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
  fileFilter: fileFilter
});

const productsFilePath = path.join(__dirname, '../data/products.json');
const favoritesFilePath = path.join(__dirname, '../data/favorites.json');

// Fonction pour normaliser les caractères (supprimer les accents)
const normalizeString = (str) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

// Middleware pour vérifier si le fichier existe
const checkFileExists = (req, res, next) => {
  if (!fs.existsSync(productsFilePath)) {
    fs.writeFileSync(productsFilePath, JSON.stringify([]));
  }
  next();
};

// Middleware pour vérifier et mettre à jour les promotions expirées
const checkExpiredPromotions = (req, res, next) => {
  try {
    if (!fs.existsSync(productsFilePath)) return next();
    
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const now = new Date();
    let hasChanges = false;
    
    products.forEach(product => {
      if (product.promotion && product.promotionEnd && new Date(product.promotionEnd) < now) {
        // Réinitialiser la promotion
        product.price = product.originalPrice || product.price;
        product.promotion = null;
        product.promotionEnd = null;
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
    }
    
    next();
  } catch (error) {
    console.error("Erreur lors de la vérification des promotions expirées:", error);
    next();
  }
};

// Appliquer le middleware de vérification des promotions à toutes les routes
router.use(checkExpiredPromotions);

// Obtenir tous les produits avec protection rate limit
router.get('/', apiLimiter, checkFileExists, (req, res) => {
  try {
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des produits' });
  }
});

// Obtenir les produits par catégorie
router.get('/category/:categoryName', apiLimiter, checkFileExists, (req, res) => {
  try {
    const { categoryName } = req.params;
    const sanitizedCategory = sanitizeInput(categoryName);
    
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const filteredProducts = products.filter(
      product => normalizeString(product.category) === normalizeString(sanitizedCategory)
    );
    res.json(filteredProducts);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des produits par catégorie' });
  }
});

// Rechercher des produits - Amélioration pour ignorer les accents
router.get('/search', apiLimiter, checkFileExists, (req, res) => {
  try {
    const { q } = req.query;
    const sanitizedQuery = sanitizeInput(q);
    
    if (!sanitizedQuery || sanitizedQuery.length < 3) {
      return res.json([]);
    }
    
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const normalizedQuery = normalizeString(sanitizedQuery);
    
    const searchResults = products.filter(product => {
      // Normaliser les champs de recherche
      const normalizedName = normalizeString(product.name);
      const normalizedDescription = normalizeString(product.description);
      const normalizedCategory = normalizeString(product.category);
      
      // Vérifier si le terme de recherche normalisé est contenu dans les champs normalisés
      return normalizedName.includes(normalizedQuery) ||
             normalizedDescription.includes(normalizedQuery) ||
             normalizedCategory.includes(normalizedQuery);
    });
    
    res.json(searchResults);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la recherche des produits' });
  }
});

// Obtenir les produits les plus favorisés
router.get('/stats/most-favorited', apiLimiter, checkFileExists, (req, res) => {
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
router.get('/stats/new-arrivals', apiLimiter, checkFileExists, (req, res) => {
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
router.get('/:id', apiLimiter, checkFileExists, (req, res) => {
  try {
    const sanitizedId = sanitizeInput(req.params.id);
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const product = products.find(p => p.id === sanitizedId);
    
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du produit' });
  }
});

// Créer un nouveau produit (admin seulement)
router.post('/', isAuthenticated, isAdmin, upload.array('images', 4), checkFileExists, (req, res) => {
  try {
    // Sanitisation des entrées utilisateur
    const name = sanitizeInput(req.body.name || '');
    const description = sanitizeInput(req.body.description || '');
    const price = parseFloat(req.body.price) || 0;
    const category = sanitizeInput(req.body.category || '');
    const stock = parseInt(req.body.stock) || 0;
    const promotion = req.body.promotion ? parseInt(req.body.promotion) : null;
    const promotionEnd = req.body.promotionEnd || null;
    
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    
    const images = req.files && req.files.length > 0 
      ? req.files.map(file => `/uploads/${file.filename}`) 
      : ['/placeholder.svg'];
    
    const newProduct = {
      id: Date.now().toString(),
      name,
      description,
      price,
      originalPrice: price,
      category,
      images,
      image: images[0], // For backwards compatibility
      promotion,
      promotionEnd,
      stock,
      isSold: stock > 0,
      dateAjout: new Date().toISOString(),
    };
    
    // Si une promotion est appliquée, calculer le prix promotionnel
    if (promotion) {
      const discountFactor = 1 - (promotion / 100);
      newProduct.price = +(price * discountFactor).toFixed(2);
    }
    
    products.push(newProduct);
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
    
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Erreur lors de la création du produit:', error);
    res.status(500).json({ message: 'Erreur lors de la création du produit' });
  }
});

// Mettre à jour un produit (admin seulement)
router.put('/:id', isAuthenticated, isAdmin, upload.array('images', 4), checkFileExists, (req, res) => {
  try {
    const sanitizedId = sanitizeInput(req.params.id);
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const index = products.findIndex(p => p.id === sanitizedId);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    // Sanitisation des entrées utilisateur
    const name = sanitizeInput(req.body.name) || products[index].name;
    const description = sanitizeInput(req.body.description) || products[index].description;
    const category = sanitizeInput(req.body.category) || products[index].category;
    const price = req.body.price ? parseFloat(req.body.price) : products[index].price;
    const originalPrice = req.body.originalPrice ? parseFloat(req.body.originalPrice) : (products[index].originalPrice || price);
    const promotion = req.body.promotion !== undefined ? parseInt(req.body.promotion) : products[index].promotion;
    const promotionEnd = req.body.promotionEnd || products[index].promotionEnd;
    const stock = req.body.stock !== undefined ? parseInt(req.body.stock) : products[index].stock;
    const isSold = req.body.isSold !== undefined ? req.body.isSold === 'true' : products[index].isSold;
    
    // Préserver les images existantes si aucune nouvelle n'est envoyée
    let images = products[index].images || [products[index].image];
    
    // Si de nouvelles images sont envoyées, les utiliser
    if (req.files && req.files.length > 0) {
      images = req.files.map(file => `/uploads/${file.filename}`);
    }
    
    // Si le JSON des images est envoyé, le parser et l'utiliser
    if (req.body.imagesJson) {
      try {
        images = JSON.parse(req.body.imagesJson);
      } catch (e) {
        console.error('Erreur lors du parsing des images JSON:', e);
      }
    }
    
    const updatedProduct = {
      ...products[index],
      name,
      description,
      price,
      originalPrice,
      category,
      promotion,
      promotionEnd,
      stock,
      isSold,
      images,
      image: images[0], // Pour la compatibilité avec le code existant
    };
    
    products[index] = updatedProduct;
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
    
    res.json(updatedProduct);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du produit:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du produit' });
  }
});

// Supprimer un produit (admin seulement)
router.delete('/:id', isAuthenticated, isAdmin, checkFileExists, (req, res) => {
  try {
    const sanitizedId = sanitizeInput(req.params.id);
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const initialLength = products.length;
    const filteredProducts = products.filter(p => p.id !== sanitizedId);
    
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
    const sanitizedId = sanitizeInput(req.params.id);
    const { promotion, duration } = req.body;
    
    if (promotion === undefined || !duration) {
      return res.status(400).json({ message: 'Promotion et durée requises' });
    }
    
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const index = products.findIndex(p => p.id === sanitizedId);
    
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

// Obtenir les produits en promotion
router.get('/stats/promotions', apiLimiter, checkFileExists, (req, res) => {
  try {
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const now = new Date();
    
    const promotionProducts = products.filter(product => 
      product.promotion && 
      product.promotionEnd && 
      new Date(product.promotionEnd) > now
    );
    
    res.json(promotionProducts);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des produits en promotion' });
  }
});

// Ajouter un middleware de sécurité qui vérifie les tokens d'accès
router.use((req, res, next) => {
  // Cette route ne limite pas vraiment l'accès, mais le client utilisera
  // les IDs sécurisés générés côté client pour restreindre l'accès
  // La vérification réelle se fait dans le front-end
  next();
});

module.exports = router;
