
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isAuthenticated, isAdmin } = require('../middlewares/auth');

const ordersFilePath = path.join(__dirname, '../data/commandes.json');
const productsFilePath = path.join(__dirname, '../data/products.json');

// Vérifier si le fichier commandes.json existe, sinon le créer
if (!fs.existsSync(ordersFilePath)) {
  fs.writeFileSync(ordersFilePath, JSON.stringify([], null, 2));
}

// Obtenir toutes les commandes (admin seulement)
router.get('/', isAuthenticated, isAdmin, (req, res) => {
  try {
    const orders = JSON.parse(fs.readFileSync(ordersFilePath));
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des commandes' });
  }
});

// Obtenir les commandes d'un utilisateur
router.get('/user', isAuthenticated, (req, res) => {
  try {
    const orders = JSON.parse(fs.readFileSync(ordersFilePath));
    const userOrders = orders.filter(order => order.userId === req.user.id);
    res.json(userOrders);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des commandes' });
  }
});

// Obtenir une commande spécifique
router.get('/:orderId', isAuthenticated, (req, res) => {
  try {
    const orders = JSON.parse(fs.readFileSync(ordersFilePath));
    const order = orders.find(o => o.id === req.params.orderId);
    
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }
    
    // Vérifier que l'utilisateur a accès à cette commande ou est admin
    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé à cette commande' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération de la commande' });
  }
});

// Créer une nouvelle commande
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Aucun article dans la commande' });
    }
    
    // Vérifier et mettre à jour le stock de chaque produit
    const products = JSON.parse(fs.readFileSync(productsFilePath));
    let totalAmount = 0;
    const orderItems = [];
    
    for (const item of items) {
      const productIndex = products.findIndex(p => p.id === item.productId);
      
      if (productIndex === -1) {
        return res.status(400).json({ 
          message: `Produit ${item.productId} non trouvé` 
        });
      }
      
      const product = products[productIndex];
      
      if (!product.stock || product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Stock insuffisant pour le produit ${product.name}` 
        });
      }
      
      // Mettre à jour le stock
      product.stock -= item.quantity;
      product.isSold = product.stock > 0;
      
      // Ajouter le produit à la commande avec TOUS les détails pertinents
      const orderItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice || product.price,
        quantity: item.quantity,
        image: product.image || '/placeholder.svg',
        description: product.description,
        category: product.category,
        subtotal: product.price * item.quantity
      };
      
      orderItems.push(orderItem);
      totalAmount += orderItem.subtotal;
      
      // Mettre à jour le produit dans la liste
      products[productIndex] = product;
    }
    
    // Enregistrer les modifications de stock
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
    
    // Créer la commande
    const orders = JSON.parse(fs.readFileSync(ordersFilePath));
    const newOrder = {
      id: `ORD-${Date.now()}`,
      userId: req.user.id,
      userName: req.user.nom,
      userEmail: req.user.email,
      items: orderItems,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      shippingAddress,
      paymentMethod,
      status: 'confirmée',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    orders.push(newOrder);
    fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2));
    
    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Erreur lors de la création de la commande:', error);
    res.status(500).json({ message: 'Erreur lors de la création de la commande' });
  }
});

// Mettre à jour le statut d'une commande (admin seulement)
router.put('/:orderId/status', isAuthenticated, isAdmin, (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['confirmée', 'en préparation', 'en livraison', 'livrée'].includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }
    
    const orders = JSON.parse(fs.readFileSync(ordersFilePath));
    const orderIndex = orders.findIndex(o => o.id === req.params.orderId);
    
    if (orderIndex === -1) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }
    
    orders[orderIndex].status = status;
    orders[orderIndex].updatedAt = new Date().toISOString();
    
    fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2));
    
    res.json(orders[orderIndex]);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut de la commande' });
  }
});

module.exports = router;
