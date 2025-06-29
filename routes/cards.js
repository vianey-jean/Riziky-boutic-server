const express = require('express');
const cardsService = require('../services/cards.service');
const { isAuthenticated } = require('../middlewares/auth');
const router = express.Router();

// Obtenir toutes les cartes de l'utilisateur
router.get('/', isAuthenticated, (req, res) => {
  try {
    console.log('🎯 Récupération des cartes pour l\'utilisateur ID:', req.user.id);
    const cards = cardsService.getUserCards(req.user.id);
    res.json({ success: true, data: cards });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des cartes:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération des cartes' });
  }
});

// Obtenir une carte spécifique
router.get('/:cardId', isAuthenticated, (req, res) => {
  try {
    const card = cardsService.getCardById(req.params.cardId, req.user.id);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Carte non trouvée' });
    }
    res.json({ success: true, data: card });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération de la carte:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération de la carte' });
  }
});

// Ajouter une nouvelle carte
router.post('/', isAuthenticated, (req, res) => {
  try {
    console.log('📥 Requête d\'ajout de carte reçue pour l\'utilisateur ID:', req.user.id);
    console.log('📋 Corps de la requête:', { 
      cardName: req.body.cardName, 
      cardNumber: req.body.cardNumber ? '****' + req.body.cardNumber.slice(-4) : 'N/A',
      expiryDate: req.body.expiryDate,
      cvv: req.body.cvv ? '***' : 'N/A',
      setAsDefault: req.body.setAsDefault
    });

    const { cardNumber, cardName, expiryDate, cvv, setAsDefault = false } = req.body;
    
    // Validation des champs requis
    if (!cardNumber || !cardName || !expiryDate || !cvv) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tous les champs sont requis (cardNumber, cardName, expiryDate, cvv)' 
      });
    }

    const cardId = cardsService.addCard(req.user.id, {
      cardNumber,
      cardName,
      expiryDate,
      cvv
    }, setAsDefault);

    console.log('✅ Carte ajoutée avec succès, ID:', cardId);
    res.json({ 
      success: true, 
      message: 'Carte ajoutée avec succès',
      cardId 
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout de la carte:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de l\'ajout de la carte: ' + error.message 
    });
  }
});

// Définir une carte comme défaut
router.put('/:cardId/default', isAuthenticated, (req, res) => {
  try {
    const success = cardsService.setDefaultCard(req.params.cardId, req.user.id);
    if (!success) {
      return res.status(404).json({ success: false, message: 'Carte non trouvée' });
    }
    res.json({ success: true, message: 'Carte définie comme défaut' });
  } catch (error) {
    console.error('Erreur lors de la définition de la carte par défaut:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer une carte
router.delete('/:cardId', isAuthenticated, (req, res) => {
  try {
    const success = cardsService.deleteCard(req.params.cardId, req.user.id);
    if (!success) {
      return res.status(404).json({ success: false, message: 'Carte non trouvée' });
    }
    res.json({ success: true, message: 'Carte supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la carte:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
