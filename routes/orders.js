const express = require('express');
const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../middlewares/auth');

const router = express.Router();

// Chemins vers les fichiers JSON
const ordersPath = path.join(__dirname, '../data/orders.json');
const commandesPath = path.join(__dirname, '../data/commandes.json');

// Fonction utilitaire pour lire un fichier JSON
function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Fonction utilitaire pour écrire dans un fichier JSON
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, codePromo } = req.body;

    // Validation des items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'La commande doit contenir au moins un article.' });
    }

    for (const item of items) {
      if (!item.productId || typeof item.productId !== 'string') {
        return res.status(400).json({ message: 'Chaque article doit avoir un productId valide.' });
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        return res.status(400).json({ message: 'Chaque article doit avoir une quantité valide.' });
      }
      if (typeof item.price !== 'number' || item.price < 0) {
        return res.status(400).json({ message: 'Chaque article doit avoir un prix valide.' });
      }
    }

    // Validation de l'adresse de livraison
    const requiredFields = ['nom', 'prenom', 'adresse', 'ville', 'codePostal', 'pays', 'telephone'];
    for (const field of requiredFields) {
      if (!shippingAddress || !shippingAddress[field] || typeof shippingAddress[field] !== 'string') {
        return res.status(400).json({ message: `Le champ ${field} de l'adresse est requis.` });
      }
    }

    // Validation de la méthode de paiement
    if (!paymentMethod || typeof paymentMethod !== 'string') {
      return res.status(400).json({ message: 'La méthode de paiement est requise.' });
    }

    // Lire les commandes existantes
    const orders = readJSON(ordersPath);
    const commandes = readJSON(commandesPath);

    // Créer une nouvelle commande
    const newOrder = {
      id: Date.now().toString(),
      user: req.user.id,
      items,
      shippingAddress,
      paymentMethod,
      codePromo: codePromo || null,
      createdAt: new Date().toISOString()
    };

    // Enregistrer la commande dans orders.json et commandes.json
    orders.push(newOrder);
    commandes.push(newOrder);

    writeJSON(ordersPath, orders);
    writeJSON(commandesPath, commandes);

    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Erreur lors de la création de la commande:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;
