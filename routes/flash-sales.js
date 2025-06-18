const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middlewares/auth');
const sanitizeHtml = require('sanitize-html');
const rateLimit = require('express-rate-limit');
const flashSaleService = require('../services/flashSale.service');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Trop de requêtes, veuillez réessayer plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
});

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

// Middleware pour s'assurer que les fichiers existent
const ensureDataIntegrity = (req, res, next) => {
  try {
    // S'assurer que le service est initialisé
    flashSaleService.initializeFiles();
    next();
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des données:', error);
    res.status(500).json({ 
      message: 'Erreur lors de l\'initialisation des données',
      error: error.message 
    });
  }
};

// Obtenir toutes les ventes flash actives (nouveau endpoint)
router.get('/active-all', apiLimiter, ensureDataIntegrity, (req, res) => {
  try {
    console.log('🌐 Demande de toutes les ventes flash actives');
    
    const activeFlashSales = flashSaleService.getActiveFlashSales();
    
    if (!activeFlashSales || activeFlashSales.length === 0) {
      console.log('ℹ️ Aucune vente flash active');
      return res.status(404).json({ message: 'Aucune vente flash active' });
    }
    
    console.log(`📦 Retour de ${activeFlashSales.length} ventes flash actives`);
    res.json(activeFlashSales);
  } catch (error) {
    console.error('💥 Erreur lors de la récupération des ventes flash actives:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des ventes flash actives',
      error: error.message 
    });
  }
});

router.get('/banniere-products', apiLimiter, ensureDataIntegrity, (req, res) => {
  try {
    console.log('🌐 Demande des produits bannière flash sale');
    
    const banniereProducts = flashSaleService.getBanniereProducts();
    
    console.log(`📦 Retour de ${banniereProducts.length} produits bannière`);
    res.json(banniereProducts);
  } catch (error) {
    console.error('💥 Erreur lors de la récupération des produits bannière:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des produits de la bannière',
      error: error.message 
    });
  }
});

// Obtenir la vente flash active
router.get('/active', apiLimiter, ensureDataIntegrity, (req, res) => {
  try {
    console.log('🌐 Demande de vente flash active');
    
    const activeFlashSale = flashSaleService.getActiveFlashSale();
    
    if (!activeFlashSale) {
      console.log('ℹ️ Aucune vente flash active');
      return res.status(404).json({ message: 'Aucune vente flash active' });
    }
    
    console.log('✅ Vente flash active trouvée:', activeFlashSale.title);
    res.json(activeFlashSale);
  } catch (error) {
    console.error('💥 Erreur lors de la récupération de la vente flash active:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération de la vente flash active',
      error: error.message 
    });
  }
});

// Obtenir toutes les ventes flash
router.get('/', isAuthenticated, isAdmin, ensureDataIntegrity, (req, res) => {
  try {
    console.log('🌐 Demande de toutes les ventes flash');
    
    const flashSales = flashSaleService.getAllFlashSales();
    
    console.log(`📦 Retour de ${flashSales.length} ventes flash`);
    res.json(flashSales);
  } catch (error) {
    console.error('💥 Erreur lors de la récupération des ventes flash:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des ventes flash',
      error: error.message 
    });
  }
});

// Obtenir une vente flash par ID
router.get('/:id', apiLimiter, ensureDataIntegrity, (req, res) => {
  try {
    const sanitizedId = sanitizeInput(req.params.id);
    console.log('🌐 Demande de vente flash par ID:', sanitizedId);
    
    const flashSale = flashSaleService.getFlashSaleById(sanitizedId);
    
    if (!flashSale) {
      console.log('❌ Vente flash non trouvée pour ID:', sanitizedId);
      return res.status(404).json({ message: 'Vente flash non trouvée' });
    }
    
    console.log('✅ Vente flash trouvée:', flashSale.title);
    res.json(flashSale);
  } catch (error) {
    console.error('💥 Erreur lors de la récupération de la vente flash:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération de la vente flash',
      error: error.message 
    });
  }
});

// Obtenir les produits d'une vente flash
router.get('/:id/products', apiLimiter, ensureDataIntegrity, (req, res) => {
  try {
    const sanitizedId = sanitizeInput(req.params.id);
    console.log('🌐 Demande des produits de vente flash pour ID:', sanitizedId);
    
    const flashSaleProducts = flashSaleService.getFlashSaleProducts(sanitizedId);
    
    console.log(`📦 Retour de ${flashSaleProducts.length} produits pour la vente flash`);
    res.json(flashSaleProducts);
  } catch (error) {
    console.error('💥 Erreur lors de la récupération des produits de la vente flash:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des produits de la vente flash',
      error: error.message 
    });
  }
});

// Créer une nouvelle vente flash
router.post('/', isAuthenticated, isAdmin, ensureDataIntegrity, (req, res) => {
  try {
    const { title, description, discount, startDate, endDate, productIds, backgroundColor, icon, emoji, order } = req.body;
    
    console.log('🌐 Création d\'une nouvelle vente flash:', { title, discount });
    
    const sanitizedTitle = sanitizeInput(title);
    const sanitizedDescription = sanitizeInput(description);
    
    if (!sanitizedTitle || !discount || !startDate || !endDate) {
      return res.status(400).json({ message: 'Tous les champs requis doivent être remplis' });
    }
    
    const newFlashSale = flashSaleService.createFlashSale({
      title: sanitizedTitle,
      description: sanitizedDescription,
      discount,
      startDate,
      endDate,
      productIds,
      backgroundColor,
      icon,
      emoji,
      order
    });
    
    console.log('✅ Nouvelle vente flash créée:', newFlashSale.id);
    res.status(201).json(newFlashSale);
  } catch (error) {
    console.error('💥 Erreur lors de la création de la vente flash:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la création de la vente flash',
      error: error.message 
    });
  }
});

// Mettre à jour une vente flash
router.put('/:id', isAuthenticated, isAdmin, ensureDataIntegrity, (req, res) => {
  try {
    const sanitizedId = sanitizeInput(req.params.id);
    console.log('🌐 Mise à jour de la vente flash:', sanitizedId);
    
    const updatedData = { ...req.body };
    if (updatedData.title) updatedData.title = sanitizeInput(updatedData.title);
    if (updatedData.description) updatedData.description = sanitizeInput(updatedData.description);
    
    const updatedFlashSale = flashSaleService.updateFlashSale(sanitizedId, updatedData);
    
    if (!updatedFlashSale) {
      return res.status(404).json({ message: 'Vente flash non trouvée' });
    }
    
    console.log('✅ Vente flash mise à jour:', updatedFlashSale.id);
    res.json(updatedFlashSale);
  } catch (error) {
    console.error('💥 Erreur lors de la mise à jour de la vente flash:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la mise à jour de la vente flash',
      error: error.message 
    });
  }
});

// Supprimer une vente flash
router.delete('/:id', isAuthenticated, isAdmin, ensureDataIntegrity, (req, res) => {
  try {
    const sanitizedId = sanitizeInput(req.params.id);
    console.log('🌐 Suppression de la vente flash:', sanitizedId);
    
    const deleted = flashSaleService.deleteFlashSale(sanitizedId);
    
    if (!deleted) {
      return res.status(404).json({ message: 'Vente flash non trouvée' });
    }
    
    console.log('✅ Vente flash supprimée:', sanitizedId);
    res.json({ message: 'Vente flash supprimée avec succès' });
  } catch (error) {
    console.error('💥 Erreur lors de la suppression de la vente flash:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la suppression de la vente flash',
      error: error.message 
    });
  }
});

// Activer une vente flash
router.post('/:id/activate', isAuthenticated, isAdmin, ensureDataIntegrity, (req, res) => {
  try {
    const sanitizedId = sanitizeInput(req.params.id);
    console.log('🌐 Activation de la vente flash:', sanitizedId);
    
    const activatedFlashSale = flashSaleService.activateFlashSale(sanitizedId);
    
    if (!activatedFlashSale) {
      return res.status(404).json({ message: 'Vente flash non trouvée' });
    }
    
    console.log('✅ Vente flash activée:', activatedFlashSale.title);
    res.json(activatedFlashSale);
  } catch (error) {
    console.error('💥 Erreur lors de l\'activation de la vente flash:', error);
    res.status(500).json({ 
      message: 'Erreur lors de l\'activation de la vente flash',
      error: error.message 
    });
  }
});

// Désactiver une vente flash
router.post('/:id/deactivate', isAuthenticated, isAdmin, ensureDataIntegrity, (req, res) => {
  try {
    const sanitizedId = sanitizeInput(req.params.id);
    console.log('🌐 Désactivation de la vente flash:', sanitizedId);
    
    const deactivatedFlashSale = flashSaleService.deactivateFlashSale(sanitizedId);
    
    if (!deactivatedFlashSale) {
      return res.status(404).json({ message: 'Vente flash non trouvée' });
    }
    
    console.log('✅ Vente flash désactivée:', deactivatedFlashSale.title);
    res.json(deactivatedFlashSale);
  } catch (error) {
    console.error('💥 Erreur lors de la désactivation de la vente flash:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la désactivation de la vente flash',
      error: error.message 
    });
  }
});

// Nettoyer l'interval lors de l'arrêt du serveur
process.on('SIGINT', () => {
  clearInterval(cleanupInterval);
  process.exit(0);
});

process.on('SIGTERM', () => {
  clearInterval(cleanupInterval);
  process.exit(0);
});

// Nettoyer les ventes flash expirées et régénérer la bannière toutes les heures
const cleanupInterval = setInterval(() => {
  try {
    flashSaleService.cleanExpiredFlashSales();
    flashSaleService.generateBanniereFlashSale();
  } catch (error) {
    console.error('Erreur lors du nettoyage automatique:', error);
  }
}, 60 * 60 * 1000);

module.exports = router;
