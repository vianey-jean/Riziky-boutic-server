const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const database = require('../core/database');

// Configuration de Multer pour la gestion des fichiers uploadés
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/remboursements');
    // Créer le répertoire s'il n'existe pas
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Middleware pour valider le formulaire
const validateRemboursement = (req, res, next) => {
  const { orderId, amount, reason } = req.body;

  if (!orderId || !amount || !reason) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Le montant doit être un nombre positif' });
  }

  next();
};

// GET - Récupérer tous les remboursements
router.get('/', (req, res) => {
  try {
    const remboursements = database.read('remboursements.json');
    res.json(remboursements);
  } catch (error) {
    console.error('Erreur lors de la récupération des remboursements:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des remboursements' });
  }
});

// GET - Récupérer un remboursement par ID
router.get('/:id', (req, res) => {
  try {
    const remboursements = database.read('remboursements.json');
    const remboursement = remboursements.find(r => r.id === req.params.id);

    if (!remboursement) {
      return res.status(404).json({ error: 'Remboursement non trouvé' });
    }

    res.json(remboursement);
  } catch (error) {
    console.error('Erreur lors de la récupération du remboursement:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du remboursement' });
  }
});

// Créer un nouveau remboursement
router.post('/', upload.array('photos', 5), async (req, res) => {
  try {
    const { orderId, amount, reason } = req.body;

    if (!orderId || !amount || !reason) {
      return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Le montant doit être un nombre positif' });
    }

    const photos = req.files ? req.files.map(file => `/uploads/remboursements/${file.filename}`) : [];
    const remboursements = database.read('remboursements.json');

    const newRemboursement = {
      id: Date.now().toString(),
      orderId,
      amount: parsedAmount,
      reason,
      photos,
      status: 'pending',
      dateRequested: new Date().toISOString(),
      adminComment: null
    };

    remboursements.push(newRemboursement);
    database.write('remboursements.json', remboursements);

    // Envoyer notification aux admins si activée
    try {
      const settings = database.read('settings.json');
      if (settings.notifications?.emailNotifications?.refundRequest) {
        // La notification sera gérée côté client via le service de notifications
        console.log('Notification de remboursement activée pour la demande:', newRemboursement.id);
      }
    } catch (notifError) {
      console.error('Erreur lors de la vérification des notifications:', notifError);
    }

    res.status(201).json(newRemboursement);
  } catch (error) {
    console.error('Erreur lors de la création du remboursement:', error);
    res.status(500).json({ error: 'Erreur lors de la création du remboursement' });
  }
});

// Mettre à jour le statut d'un remboursement
router.put('/:id/status', (req, res) => {
  try {
    const { status, adminComment } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Le statut est obligatoire' });
    }

    const remboursements = database.read('remboursements.json');
    const remboursementIndex = remboursements.findIndex(r => r.id === req.params.id);

    if (remboursementIndex === -1) {
      return res.status(404).json({ error: 'Remboursement non trouvé' });
    }

    remboursements[remboursementIndex] = {
      ...remboursements[remboursementIndex],
      status: status,
      adminComment: adminComment || null
    };

    database.write('remboursements.json', remboursements);
    res.json(remboursements[remboursementIndex]);

  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut du remboursement:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut du remboursement' });
  }
});

// DELETE - Supprimer un remboursement
router.delete('/:id', (req, res) => {
  try {
    let remboursements = database.read('remboursements.json');
    const initialLength = remboursements.length;
    remboursements = remboursements.filter(r => r.id !== req.params.id);

    if (remboursements.length === initialLength) {
      return res.status(404).json({ error: 'Remboursement non trouvé' });
    }

    database.write('remboursements.json', remboursements);
    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression du remboursement:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du remboursement' });
  }
});

module.exports = router;
