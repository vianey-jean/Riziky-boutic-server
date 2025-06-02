
const express = require('express');
const router = express.Router();
const database = require('../core/database');

// Map pour suivre les utilisateurs en ligne (en mémoire)
const onlineUsers = new Map();

// Structure des données visiteurs
const initializeVisitorData = () => {
  const now = new Date();
  return {
    daily: {
      date: now.toISOString().split('T')[0],
      count: 0,
      uniqueVisitors: []
    },
    weekly: {
      week: getWeekNumber(now),
      year: now.getFullYear(),
      count: 0
    },
    monthly: {
      month: now.getMonth(),
      year: now.getFullYear(),
      count: 0
    },
    yearly: {
      year: now.getFullYear(),
      count: 0
    },
    currentViewing: 0,
    lastVisit: now.toISOString(),
    onlineUsers: []
  };
};

// Fonction pour obtenir le numéro de semaine
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Générer un ID utilisateur unique basé sur l'IP, User-Agent et autres identifiants
function generateUserId(req) {
  const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const acceptLanguage = req.headers['accept-language'] || 'unknown';
  const acceptEncoding = req.headers['accept-encoding'] || 'unknown';
  
  // Créer un identifiant unique combinant plusieurs éléments
  return `${ip}_${Buffer.from(userAgent + acceptLanguage + acceptEncoding).toString('base64').slice(0, 20)}`;
}

// Nettoyer les utilisateurs hors ligne (plus de 30 secondes d'inactivité)
const cleanupOfflineUsers = () => {
  const now = Date.now();
  const timeout = 30000; // 30 secondes
  
  for (const [userId, lastSeen] of onlineUsers.entries()) {
    if (now - lastSeen > timeout) {
      onlineUsers.delete(userId);
      console.log(`Utilisateur ${userId} marqué hors ligne`);
    }
  }
};

// Simuler des visites aléatoires pour démonstration
const simulateRandomVisits = () => {
  setInterval(() => {
    // Simuler 1-3 nouvelles visites aléatoires toutes les 10-30 secondes
    const randomVisits = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < randomVisits; i++) {
      const fakeUserId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        let visitorData = database.read('visitors.json')[0] || initializeVisitorData();
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Réinitialiser si nouveau jour
        if (visitorData.daily.date !== today) {
          visitorData.daily = {
            date: today,
            count: 0,
            uniqueVisitors: []
          };
        }

        // Ajouter le visiteur simulé
        if (!visitorData.daily.uniqueVisitors.includes(fakeUserId)) {
          visitorData.daily.uniqueVisitors.push(fakeUserId);
          visitorData.daily.count++;
          visitorData.weekly.count++;
          visitorData.monthly.count++;
          visitorData.yearly.count++;
          
          // Marquer temporairement comme en ligne
          onlineUsers.set(fakeUserId, Date.now());
          
          // Retirer après 5-15 secondes
          setTimeout(() => {
            onlineUsers.delete(fakeUserId);
          }, Math.floor(Math.random() * 10000) + 5000);

          database.write('visitors.json', [visitorData]);
          console.log(`Visite simulée ajoutée: ${fakeUserId}, Total aujourd'hui: ${visitorData.daily.count}`);
        }
      } catch (error) {
        console.error('Erreur lors de la simulation de visite:', error);
      }
    }
  }, Math.floor(Math.random() * 20000) + 10000); // Entre 10 et 30 secondes
};

// Démarrer la simulation des visites
simulateRandomVisits();

// Enregistrer une visite
router.post('/record', (req, res) => {
  try {
    const now = new Date();
    const userId = generateUserId(req);
    
    console.log(`Tentative d'enregistrement de visite pour: ${userId}`);
    
    // Marquer l'utilisateur comme en ligne
    onlineUsers.set(userId, Date.now());
    
    let visitorData = database.read('visitors.json')[0] || initializeVisitorData();
    
    const today = now.toISOString().split('T')[0];
    const currentWeek = getWeekNumber(now);
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Réinitialiser si nouveau jour
    if (visitorData.daily.date !== today) {
      visitorData.daily = {
        date: today,
        count: 0,
        uniqueVisitors: []
      };
    }

    // Réinitialiser si nouvelle semaine
    if (visitorData.weekly.week !== currentWeek || visitorData.weekly.year !== currentYear) {
      visitorData.weekly = {
        week: currentWeek,
        year: currentYear,
        count: 0
      };
    }

    // Réinitialiser si nouveau mois
    if (visitorData.monthly.month !== currentMonth || visitorData.monthly.year !== currentYear) {
      visitorData.monthly = {
        month: currentMonth,
        year: currentYear,
        count: 0
      };
    }

    // Réinitialiser si nouvelle année
    if (visitorData.yearly.year !== currentYear) {
      visitorData.yearly = {
        year: currentYear,
        count: 0
      };
    }

    // Vérifier si c'est un visiteur unique pour aujourd'hui
    if (!visitorData.daily.uniqueVisitors.includes(userId)) {
      visitorData.daily.uniqueVisitors.push(userId);
      visitorData.daily.count++;
      visitorData.weekly.count++;
      visitorData.monthly.count++;
      visitorData.yearly.count++;
      console.log(`Nouveau visiteur unique ajouté: ${userId}, Total: ${visitorData.daily.count}`);
    }
    
    // Nettoyer les utilisateurs hors ligne
    cleanupOfflineUsers();
    
    // Mettre à jour le nombre d'utilisateurs en ligne
    visitorData.currentViewing = onlineUsers.size;
    visitorData.lastVisit = now.toISOString();

    database.write('visitors.json', [visitorData]);

    console.log(`Statistiques mises à jour - Aujourd'hui: ${visitorData.daily.count}, En ligne: ${visitorData.currentViewing}`);

    res.json({
      today: visitorData.daily.count,
      week: visitorData.weekly.count,
      month: visitorData.monthly.count,
      year: visitorData.yearly.count,
      currentViewing: visitorData.currentViewing
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la visite:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Mettre à jour le statut en ligne avec heartbeat
router.post('/heartbeat', (req, res) => {
  try {
    const userId = generateUserId(req);
    
    // Mettre à jour le timestamp de l'utilisateur
    onlineUsers.set(userId, Date.now());
    
    // Nettoyer les utilisateurs hors ligne
    cleanupOfflineUsers();
    
    console.log(`Heartbeat reçu de ${userId}, Total en ligne: ${onlineUsers.size}`);
    
    res.json({ 
      success: true,
      currentViewing: onlineUsers.size 
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du heartbeat:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Récupérer les statistiques en temps réel
router.get('/stats', (req, res) => {
  try {
    let visitorData = database.read('visitors.json')[0] || initializeVisitorData();
    
    // Nettoyer les utilisateurs hors ligne
    cleanupOfflineUsers();
    
    // Mettre à jour le nombre d'utilisateurs en ligne en temps réel
    visitorData.currentViewing = onlineUsers.size;
    
    // Sauvegarder la mise à jour
    database.write('visitors.json', [visitorData]);
    
    const stats = {
      today: visitorData.daily?.count || 0,
      week: visitorData.weekly?.count || 0,
      month: visitorData.monthly?.count || 0,
      year: visitorData.yearly?.count || 0,
      currentViewing: visitorData.currentViewing
    };
    
    console.log(`Stats envoyées: ${JSON.stringify(stats)}`);
    
    res.json(stats);
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
