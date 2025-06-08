
const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middlewares/auth');
const dataSyncService = require('../services/dataSync.service');

// Obtenir les statistiques des données
router.get('/stats', isAuthenticated, isAdmin, (req, res) => {
  try {
    const stats = dataSyncService.getDataStats();
    res.json(stats);
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message 
    });
  }
});

// Vérifier l'intégrité des données
router.get('/integrity', isAuthenticated, isAdmin, (req, res) => {
  try {
    const report = dataSyncService.validateDataIntegrity();
    res.json(report);
  } catch (error) {
    console.error('Erreur lors de la vérification d\'intégrité:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la vérification d\'intégrité',
      error: error.message 
    });
  }
});

// Synchroniser les données
router.post('/sync', isAuthenticated, isAdmin, (req, res) => {
  try {
    const syncResult = dataSyncService.syncData();
    res.json({
      message: 'Synchronisation réussie',
      result: syncResult
    });
  } catch (error) {
    console.error('Erreur lors de la synchronisation:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la synchronisation',
      error: error.message 
    });
  }
});

// Nettoyer les données obsolètes
router.post('/cleanup', isAuthenticated, isAdmin, (req, res) => {
  try {
    const cleanupResult = dataSyncService.cleanupData();
    res.json({
      message: 'Nettoyage réussi',
      result: cleanupResult
    });
  } catch (error) {
    console.error('Erreur lors du nettoyage:', error);
    res.status(500).json({ 
      message: 'Erreur lors du nettoyage',
      error: error.message 
    });
  }
});

module.exports = router;
