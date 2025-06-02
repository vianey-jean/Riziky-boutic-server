
const express = require('express');
const router = express.Router();
const database = require('../core/database');

// Enregistrer une nouvelle vente
router.post('/record', (req, res) => {
  try {
    const { customerName, productName, location } = req.body;
    
    const salesNotifications = database.read('sales-notifications.json');
    
    const newNotification = {
      id: Date.now().toString(),
      customerName,
      productName,
      location: location || 'France',
      timestamp: new Date().toISOString(),
      timeAgo: 'à l\'instant'
    };

    salesNotifications.unshift(newNotification);
    
    // Garder seulement les 100 dernières notifications
    if (salesNotifications.length > 100) {
      salesNotifications.splice(100);
    }

    database.write('sales-notifications.json', salesNotifications);
    
    res.json({ success: true, notification: newNotification });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la notification de vente:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Récupérer la dernière notification avec statistiques
router.get('/latest', (req, res) => {
  try {
    const { since } = req.query;
    const salesNotifications = database.read('sales-notifications.json');
    const orders = database.read('orders.json');
    
    // Calculer les statistiques de commandes
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const orderStats = {
      today: orders.filter(order => new Date(order.createdAt) >= today).length,
      week: orders.filter(order => new Date(order.createdAt) >= weekStart).length,
      month: orders.filter(order => new Date(order.createdAt) >= monthStart).length,
      year: orders.filter(order => new Date(order.createdAt) >= yearStart).length
    };

    if (salesNotifications.length === 0) {
      return res.json({ notification: null, orderStats });
    }

    const latestNotification = salesNotifications[0];
    
    // Si une date est fournie, vérifier si il y a une nouvelle notification
    if (since) {
      const sinceDate = new Date(since);
      const notificationDate = new Date(latestNotification.timestamp);
      
      if (notificationDate <= sinceDate) {
        return res.json({ notification: null, orderStats });
      }
    }

    // Calculer le temps écoulé
    const notificationTime = new Date(latestNotification.timestamp);
    const diffMinutes = Math.floor((now - notificationTime) / (1000 * 60));
    
    let timeAgo;
    if (diffMinutes < 1) {
      timeAgo = 'à l\'instant';
    } else if (diffMinutes < 60) {
      timeAgo = `il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      timeAgo = `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
    }

    res.json({
      notification: {
        ...latestNotification,
        timeAgo
      },
      orderStats
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la dernière notification:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
