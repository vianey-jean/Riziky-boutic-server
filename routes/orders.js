
const express = require('express');
const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../middlewares/auth');

const router = express.Router();

// Chemins vers les fichiers JSON
const ordersPath = path.join(__dirname, '../data/orders.json');
const commandesPath = path.join(__dirname, '../data/commandes.json');
const codePromosPath = path.join(__dirname, '../data/code-promos.json');
const productsPath = path.join(__dirname, '../data/products.json');

// Fonction utilitaire pour lire un fichier JSON
function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Erreur lors de la lecture du fichier ${filePath}:`, error);
    return [];
  }
}

// Fonction utilitaire pour écrire dans un fichier JSON
function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Erreur lors de l'écriture dans le fichier ${filePath}:`, error);
    return false;
  }
}

// Route pour obtenir toutes les commandes (pour l'admin)
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const commandes = readJSON(commandesPath);
    res.json(commandes);
  } catch (error) {
    console.error('Erreur lors de la récupération des commandes:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour obtenir les commandes de l'utilisateur connecté
router.get('/user', isAuthenticated, async (req, res) => {
  try {
    const commandes = readJSON(commandesPath);
    const userCommandes = commandes.filter(commande => commande.userId === req.user.id);
    res.json(userCommandes);
  } catch (error) {
    console.error('Erreur lors de la récupération des commandes utilisateur:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour créer une commande
router.post('/', isAuthenticated, async (req, res) => {
  console.log('Requête reçue pour créer une commande:', JSON.stringify(req.body));
  
  try {
    const { items, shippingAddress, paymentMethod, codePromo } = req.body;

    // Convertir les items de format objet à format tableau si nécessaire
    let itemsArray = items;
    if (items && typeof items === 'object' && !Array.isArray(items)) {
      itemsArray = Object.values(items);
    }

    // Validation des items
    if (!itemsArray || !Array.isArray(itemsArray) || itemsArray.length === 0) {
      return res.status(400).json({ message: 'La commande doit contenir au moins un article.' });
    }

    // Validation de l'adresse de livraison
    const requiredFields = ['nom', 'prenom', 'adresse', 'ville', 'codePostal', 'pays', 'telephone'];
    for (const field of requiredFields) {
      if (!shippingAddress || !shippingAddress[field]) {
        return res.status(400).json({ message: `Le champ ${field} de l'adresse est requis.` });
      }
    }

    // Validation de la méthode de paiement
    if (!paymentMethod || typeof paymentMethod !== 'string') {
      return res.status(400).json({ message: 'La méthode de paiement est requise.' });
    }

    // Récupérer les produits pour enrichir les données
    const products = readJSON(productsPath);
    
    // Enrichir les items avec les informations des produits
    const enrichedItems = itemsArray.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        throw new Error(`Produit non trouvé: ${item.productId}`);
      }
      
      return {
        productId: item.productId,
        name: product.name,
        price: item.price,
        originalPrice: product.originalPrice || product.price,
        quantity: item.quantity,
        image: product.images?.[0] || product.image || null,
        subtotal: item.price * item.quantity
      };
    });

    // Lire les commandes existantes
    const orders = readJSON(ordersPath);
    const commandes = readJSON(commandesPath);

    // Calculer le montant total
    let totalAmount = enrichedItems.reduce((sum, item) => sum + item.subtotal, 0);
    let originalAmount = totalAmount;
    
    // Traitement du code promo si présent
    let codePromoUsed = null;
    let discount = 0;
    
    if (codePromo) {
      const codePromos = readJSON(codePromosPath);
      const promoIndex = codePromos.findIndex(cp => cp.code === codePromo.code);
      
      if (promoIndex !== -1 && codePromos[promoIndex].quantite > 0) {
        const promo = codePromos[promoIndex];
        
        // Vérifier si le code promo s'applique à un des produits dans le panier
        const applicableItem = enrichedItems.find(item => item.productId === promo.productId);
        
        if (applicableItem) {
          // Calculer la remise
          discount = (promo.pourcentage / 100) * applicableItem.subtotal;
          totalAmount -= discount;
          
          // Mettre à jour le code promo (décrémenter la quantité)
          codePromos[promoIndex].quantite -= 1;
          writeJSON(codePromosPath, codePromos);
          
          codePromoUsed = {
            code: promo.code,
            productId: promo.productId,
            pourcentage: promo.pourcentage,
            discountAmount: discount
          };
        }
      }
    }

    // Créer une nouvelle commande avec ID unique
    const orderId = `ORD-${Date.now()}`;
    const newOrder = {
      id: orderId,
      userId: req.user.id,
      userName: `${req.user.nom} ${req.user.prenom || ''}`.trim(),
      userEmail: req.user.email,
      items: enrichedItems,
      totalAmount,
      originalAmount,
      discount,
      shippingAddress,
      paymentMethod,
      codePromoUsed,
      status: 'confirmée',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Enregistrer la commande dans orders.json et commandes.json
    orders.push(newOrder);
    commandes.push(newOrder);

    const ordersSaved = writeJSON(ordersPath, orders);
    const commandesSaved = writeJSON(commandesPath, commandes);

    if (!ordersSaved || !commandesSaved) {
      throw new Error("Erreur lors de l'enregistrement de la commande");
    }
    
    console.log('Commande créée avec succès:', orderId);
    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Erreur lors de la création de la commande:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour obtenir une commande spécifique
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const commandes = readJSON(commandesPath);
    const commande = commandes.find(c => c.id === req.params.id);
    
    if (!commande) {
      return res.status(404).json({ message: 'Commande non trouvée.' });
    }
    
    // Vérifier si l'utilisateur est autorisé à voir cette commande (admin ou propriétaire)
    if (req.user.role !== 'admin' && commande.userId !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé à cette commande.' });
    }
    
    res.json(commande);
  } catch (error) {
    console.error('Erreur lors de la récupération de la commande:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour mettre à jour le statut d'une commande
router.put('/:id/status', isAuthenticated, async (req, res) => {
  try {
    const { status } = req.body;
    
    // Vérification du rôle administrateur
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Seul un administrateur peut modifier le statut d\'une commande.' });
    }
    
    // Validation du statut
    const validStatuses = ['confirmée', 'en préparation', 'en livraison', 'livrée'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Statut de commande invalide.' });
    }
    
    const commandes = readJSON(commandesPath);
    const orderIndex = commandes.findIndex(c => c.id === req.params.id);
    
    if (orderIndex === -1) {
      return res.status(404).json({ message: 'Commande non trouvée.' });
    }
    
    // Mise à jour du statut
    commandes[orderIndex].status = status;
    commandes[orderIndex].updatedAt = new Date().toISOString();
    
    // Mise à jour également dans le fichier orders.json
    const orders = readJSON(ordersPath);
    const orderIndexInOrders = orders.findIndex(o => o.id === req.params.id);
    
    if (orderIndexInOrders !== -1) {
      orders[orderIndexInOrders].status = status;
      orders[orderIndexInOrders].updatedAt = new Date().toISOString();
      writeJSON(ordersPath, orders);
    }
    
    writeJSON(commandesPath, commandes);
    
    res.json(commandes[orderIndex]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut de la commande:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;
