
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { isAuthenticated } = require('../middlewares/auth');

const router = express.Router();

// Configuration multer pour l'upload d'images de remboursement
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/remboursement-photos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'remboursement-photo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

// Chemins vers les fichiers JSON
const remboursementsPath = path.join(__dirname, '../data/remboursements.json');
const ordersPath = path.join(__dirname, '../data/orders.json');
const commandesPath = path.join(__dirname, '../data/commandes.json');
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

// Route pour créer une demande de remboursement
router.post('/', isAuthenticated, upload.single('photo'), async (req, res) => {
  try {
    const { orderId, reason, customReason } = req.body;
    
    if (!orderId || !reason) {
      return res.status(400).json({ message: 'ID de commande et raison sont requis.' });
    }

    // Vérifier que la commande existe et appartient à l'utilisateur
    const orders = readJSON(ordersPath);
    const order = orders.find(o => o.id === orderId && o.userId === req.user.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée.' });
    }

    // Vérifier que la commande peut faire l'objet d'un remboursement
    if (order.status === 'confirmée') {
      return res.status(400).json({ message: 'Cette commande peut encore être supprimée directement.' });
    }

    const remboursements = readJSON(remboursementsPath);
    
    // Vérifier qu'il n'y a pas déjà une demande de remboursement pour cette commande
    const existingRequest = remboursements.find(r => r.orderId === orderId);
    if (existingRequest) {
      return res.status(400).json({ message: 'Une demande de remboursement existe déjà pour cette commande.' });
    }

    const remboursementId = `RMB-${Date.now()}`;
    const photoPath = req.file ? `/uploads/remboursement-photos/${req.file.filename}` : null;

    const newRemboursement = {
      id: remboursementId,
      orderId,
      userId: req.user.id,
      userName: order.userName,
      userEmail: order.userEmail,
      reason,
      customReason: customReason || '',
      photo: photoPath,
      status: 'vérification',
      adminComments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    remboursements.push(newRemboursement);
    writeJSON(remboursementsPath, remboursements);

    res.status(201).json(newRemboursement);
  } catch (error) {
    console.error('Erreur lors de la création de la demande de remboursement:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour obtenir les demandes de remboursement d'un utilisateur
router.get('/user', isAuthenticated, async (req, res) => {
  try {
    const remboursements = readJSON(remboursementsPath);
    const userRemboursements = remboursements.filter(r => r.userId === req.user.id);
    res.json(userRemboursements);
  } catch (error) {
    console.error('Erreur lors de la récupération des remboursements:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour obtenir une demande de remboursement spécifique
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const remboursements = readJSON(remboursementsPath);
    const remboursement = remboursements.find(r => r.id === req.params.id);
    
    if (!remboursement) {
      return res.status(404).json({ message: 'Demande de remboursement non trouvée.' });
    }

    // Vérifier les droits d'accès
    if (req.user.role !== 'admin' && remboursement.userId !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé.' });
    }

    res.json(remboursement);
  } catch (error) {
    console.error('Erreur lors de la récupération du remboursement:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour obtenir toutes les demandes de remboursement (admin uniquement)
router.get('/', isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès administrateur requis.' });
    }

    const remboursements = readJSON(remboursementsPath);
    res.json(remboursements);
  } catch (error) {
    console.error('Erreur lors de la récupération des remboursements:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour mettre à jour le statut d'une demande de remboursement (admin uniquement)
router.put('/:id/status', isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès administrateur requis.' });
    }

    const { status, comment, decision } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'Statut requis.' });
    }

    const validStatuses = ['vérification', 'en étude', 'traité'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Statut invalide.' });
    }

    // Si le statut est "traité", un commentaire et une décision sont obligatoires
    if (status === 'traité' && (!comment || !decision)) {
      return res.status(400).json({ message: 'Commentaire et décision requis pour le statut traité.' });
    }

    const remboursements = readJSON(remboursementsPath);
    const remboursementIndex = remboursements.findIndex(r => r.id === req.params.id);
    
    if (remboursementIndex === -1) {
      return res.status(404).json({ message: 'Demande de remboursement non trouvée.' });
    }

    const remboursement = remboursements[remboursementIndex];
    
    // Mettre à jour le statut
    remboursement.status = status;
    remboursement.updatedAt = new Date().toISOString();

    // Ajouter un commentaire si fourni
    if (comment) {
      remboursement.adminComments.push({
        id: `CMT-${Date.now()}`,
        adminId: req.user.id,
        adminName: req.user.nom,
        comment,
        status,
        createdAt: new Date().toISOString()
      });
    }

    // Si le statut est "traité", traiter la décision
    if (status === 'traité' && decision) {
      remboursement.decision = decision;
      
      if (decision === 'accepté') {
        // Supprimer la commande et restaurer le stock
        const orders = readJSON(ordersPath);
        const commandes = readJSON(commandesPath);
        const products = readJSON(productsPath);
        
        const orderIndex = orders.findIndex(o => o.id === remboursement.orderId);
        const commandeIndex = commandes.findIndex(c => c.id === remboursement.orderId);
        
        if (orderIndex !== -1) {
          const order = orders[orderIndex];
          
          // Restaurer le stock des produits
          const updatedProducts = products.map(product => {
            const orderItem = order.items.find(item => item.productId === product.id);
            if (orderItem) {
              const newStock = (product.stock || 0) + orderItem.quantity;
              return {
                ...product,
                stock: newStock,
                isSold: newStock > 0
              };
            }
            return product;
          });
          
          // Supprimer la commande
          orders.splice(orderIndex, 1);
          if (commandeIndex !== -1) {
            commandes.splice(commandeIndex, 1);
          }
          
          // Sauvegarder les modifications
          writeJSON(ordersPath, orders);
          writeJSON(commandesPath, commandes);
          writeJSON(productsPath, updatedProducts);
        }
      }
    }

    remboursements[remboursementIndex] = remboursement;
    writeJSON(remboursementsPath, remboursements);

    res.json(remboursement);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du remboursement:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;
