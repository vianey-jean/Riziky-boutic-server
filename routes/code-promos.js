
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isAuthenticated, isAdmin } = require('../middlewares/auth');
const { v4: uuidv4 } = require('uuid');

const codePromosFilePath = path.join(__dirname, '../data/code-promos.json');
const productsFilePath = path.join(__dirname, '../data/products.json');

// Vérifier si le fichier code-promos.json existe, sinon le créer
if (!fs.existsSync(codePromosFilePath)) {
  fs.writeFileSync(codePromosFilePath, JSON.stringify([], null, 2));
}

// Génération d'un code promo aléatoire
function generatePromoCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Obtenir tous les codes promos (admin uniquement)
router.get('/', isAuthenticated, isAdmin, (req, res) => {
  try {
    const codePromos = JSON.parse(fs.readFileSync(codePromosFilePath));
    res.json(codePromos);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des codes promos' });
  }
});

// Créer un nouveau code promo (admin uniquement)
router.post('/', isAuthenticated, isAdmin, (req, res) => {
  try {
    const { pourcentage, quantite, productId } = req.body;
    
    // Validation des entrées
    if (!pourcentage || !quantite || !productId) {
      return res.status(400).json({ message: 'Veuillez fournir tous les champs requis' });
    }
    
    // Vérifier si le produit existe et récupérer son nom
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const product = products.find(product => product.id === productId);
    
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    const codePromos = JSON.parse(fs.readFileSync(codePromosFilePath));
    
    // Génération du code promo unique
    let code = generatePromoCode();
    while (codePromos.some(cp => cp.code === code)) {
      code = generatePromoCode();
    }
    
    const newCodePromo = {
      id: uuidv4(),
      code,
      pourcentage: parseInt(pourcentage),
      quantite: parseInt(quantite),
      productId,
      productName: product.name
    };
    
    codePromos.push(newCodePromo);
    fs.writeFileSync(codePromosFilePath, JSON.stringify(codePromos, null, 2));
    
    res.status(201).json(newCodePromo);
  } catch (error) {
    console.error('Erreur lors de la création du code promo:', error);
    res.status(500).json({ message: 'Erreur lors de la création du code promo' });
  }
});

// Obtenir un code promo spécifique (admin uniquement)
router.get('/:id', isAuthenticated, isAdmin, (req, res) => {
  try {
    const codePromos = JSON.parse(fs.readFileSync(codePromosFilePath));
    const codePromo = codePromos.find(cp => cp.id === req.params.id);
    
    if (!codePromo) {
      return res.status(404).json({ message: 'Code promo non trouvé' });
    }
    
    res.json(codePromo);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du code promo' });
  }
});

// Mettre à jour un code promo (admin uniquement)
router.put('/:id', isAuthenticated, isAdmin, (req, res) => {
  try {
    const { quantite } = req.body;
    
    const codePromos = JSON.parse(fs.readFileSync(codePromosFilePath));
    const index = codePromos.findIndex(cp => cp.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Code promo non trouvé' });
    }
    
    codePromos[index].quantite = parseInt(quantite);
    fs.writeFileSync(codePromosFilePath, JSON.stringify(codePromos, null, 2));
    
    res.json(codePromos[index]);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du code promo' });
  }
});

// Supprimer un code promo (admin uniquement)
router.delete('/:id', isAuthenticated, isAdmin, (req, res) => {
  try {
    const codePromos = JSON.parse(fs.readFileSync(codePromosFilePath));
    const index = codePromos.findIndex(cp => cp.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Code promo non trouvé' });
    }
    
    codePromos.splice(index, 1);
    fs.writeFileSync(codePromosFilePath, JSON.stringify(codePromos, null, 2));
    
    res.json({ message: 'Code promo supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du code promo' });
  }
});

// Vérifier un code promo
router.post('/verify', async (req, res) => {
  try {
    const { code, productId } = req.body;
    
    if (!code || !productId) {
      return res.status(400).json({ 
        valid: false, 
        message: 'Veuillez fournir le code et l\'ID du produit' 
      });
    }
    
    const codePromos = JSON.parse(fs.readFileSync(codePromosFilePath));
    const codePromo = codePromos.find(cp => cp.code === code && cp.productId === productId);
    
    if (!codePromo) {
      return res.json({ 
        valid: false, 
        message: 'Code promo invalide ou non applicable à ce produit' 
      });
    }
    
    if (codePromo.quantite <= 0) {
      return res.json({ 
        valid: false, 
        message: 'Ce code promo a déjà été utilisé' 
      });
    }
    
    res.json({
      valid: true,
      pourcentage: codePromo.pourcentage
    });
  } catch (error) {
    console.error('Erreur lors de la vérification du code promo:', error);
    res.status(500).json({ 
      valid: false, 
      message: 'Erreur lors de la vérification du code promo' 
    });
  }
});

// Utiliser un code promo (après commande)
router.post('/use', isAuthenticated, async (req, res) => {
  try {
    const { code, productId } = req.body;
    
    if (!code || !productId) {
      return res.status(400).json({ success: false, message: 'Informations incomplètes' });
    }
    
    const codePromos = JSON.parse(fs.readFileSync(codePromosFilePath));
    const index = codePromos.findIndex(cp => cp.code === code && cp.productId === productId);
    
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Code promo non trouvé' });
    }
    
    if (codePromos[index].quantite <= 0) {
      return res.status(400).json({ success: false, message: 'Ce code promo a déjà été utilisé' });
    }
    
    // Réduire la quantité du code promo
    codePromos[index].quantite -= 1;
    fs.writeFileSync(codePromosFilePath, JSON.stringify(codePromos, null, 2));
    
    res.json({ success: true, message: 'Code promo utilisé avec succès' });
  } catch (error) {
    console.error('Erreur lors de l\'utilisation du code promo:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Rechercher des produits (pour l'admin lors de la création de code promo)
router.get('/products/search', isAuthenticated, isAdmin, (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 3) {
      return res.json([]);
    }
    
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    const searchResults = products.filter(product => 
      product.name.toLowerCase().includes(query.toLowerCase())
    );
    
    // Retourner juste les infos nécessaires
    const simplifiedResults = searchResults.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image || (p.images && p.images.length > 0 ? p.images[0] : null)
    }));
    
    res.json(simplifiedResults);
  } catch (error) {
    console.error('Erreur lors de la recherche de produits:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
