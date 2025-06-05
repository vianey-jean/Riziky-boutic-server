const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { authenticateToken } = require('../config/auth');
const backupService = require('../services/backup.service');

const dataDir = path.join(__dirname, '../data');

// Middleware d'authentification pour toutes les routes
router.use(authenticateToken);

// Fonction utilitaire pour lire les paramètres
const readSettings = (filename) => {
  const filePath = path.join(dataDir, filename);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.error(`Erreur lecture ${filename}:`, error);
      return null;
    }
  }
  return null;
};

// Fonction utilitaire pour écrire les paramètres
const writeSettings = (filename, data) => {
  const filePath = path.join(dataDir, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Erreur écriture ${filename}:`, error);
    return false;
  }
};

// Routes pour les paramètres généraux
router.get('/general', (req, res) => {
  const settings = readSettings('general-settings.json') || {
    siteName: 'Riziky Boutic',
    siteDescription: 'Boutique e-commerce de qualité',
    siteUrl: 'https://riziky-boutic.com',
    maintenanceMode: false,
    allowRegistration: true,
    defaultCurrency: 'EUR',
    defaultLanguage: 'fr',
    timezone: 'Europe/Paris'
  };
  res.json({ data: settings });
});

router.put('/general', (req, res) => {
  try {
    const settings = req.body;
    
    // Sauvegarder les paramètres généraux
    const success = writeSettings('general-settings.json', settings);
    
    if (success) {
      // Mettre à jour le fichier maintenance.json si nécessaire
      if (typeof settings.maintenanceMode !== 'undefined') {
        writeSettings('maintenance.json', { maintenance: settings.maintenanceMode });
      }
      
      // Mettre à jour le fichier inscription.json si nécessaire
      if (typeof settings.allowRegistration !== 'undefined') {
        writeSettings('inscription.json', { inscription: settings.allowRegistration });
      }
      
      res.json({ message: 'Paramètres généraux sauvegardés' });
    } else {
      res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
    }
  } catch (error) {
    console.error('Erreur sauvegarde paramètres généraux:', error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde des paramètres' });
  }
});

// Routes pour les paramètres SMTP
router.get('/smtp', (req, res) => {
  const settings = readSettings('smtp-settings.json') || {
    host: '',
    port: 587,
    username: '',
    password: '',
    fromEmail: '',
    fromName: '',
    encryption: 'TLS'
  };
  
  // Ne pas renvoyer le mot de passe
  const { password, ...safeSettings } = settings;
  res.json({ data: safeSettings });
});

router.put('/smtp', (req, res) => {
  const success = writeSettings('smtp-settings.json', req.body);
  if (success) {
    // Reconfigurer le service de sauvegarde avec les nouveaux paramètres SMTP
    backupService.configureSMTP(req.body);
    res.json({ message: 'Paramètres SMTP sauvegardés' });
  } else {
    res.status(500).json({ error: 'Erreur lors de la sauvegarde SMTP' });
  }
});

// Tester la connexion SMTP
router.post('/smtp/test', async (req, res) => {
  try {
    const transporter = nodemailer.createTransporter({
      host: req.body.host,
      port: req.body.port,
      secure: req.body.port === 465,
      auth: {
        user: req.body.username,
        pass: req.body.password
      }
    });

    await transporter.verify();
    res.json({ message: 'Connexion SMTP réussie' });
  } catch (error) {
    console.error('Erreur test SMTP:', error);
    res.status(500).json({ error: 'Échec de la connexion SMTP', details: error.message });
  }
});

// Routes pour les paramètres de paiement
router.get('/payment', (req, res) => {
  const settings = readSettings('payment-settings.json') || {
    stripePublishableKey: '',
    stripeSecretKey: '',
    paypalClientId: '',
    paypalClientSecret: '',
    enableStripe: false,
    enablePaypal: false,
    enableCashOnDelivery: true
  };
  
  // Ne pas renvoyer les clés secrètes
  const { stripeSecretKey, paypalClientSecret, ...safeSettings } = settings;
  res.json({ data: safeSettings });
});

router.put('/payment', (req, res) => {
  const success = writeSettings('payment-settings.json', req.body);
  if (success) {
    res.json({ message: 'Paramètres de paiement sauvegardés' });
  } else {
    res.status(500).json({ error: 'Erreur lors de la sauvegarde des paiements' });
  }
});

// Routes pour les paramètres de livraison
router.get('/shipping', (req, res) => {
  const settings = readSettings('shipping-settings.json') || {
    freeShippingThreshold: 50,
    defaultShippingCost: 5,
    shippingZones: [],
    enableFreeShipping: true
  };
  res.json({ data: settings });
});

router.put('/shipping', (req, res) => {
  const success = writeSettings('shipping-settings.json', req.body);
  if (success) {
    res.json({ message: 'Paramètres de livraison sauvegardés' });
  } else {
    res.status(500).json({ error: 'Erreur lors de la sauvegarde de la livraison' });
  }
});

// Routes pour les paramètres de sécurité
router.get('/security', (req, res) => {
  const settings = readSettings('security-settings.json') || {
    enableTwoFactor: false,
    sessionTimeout: 3600,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    requirePasswordChange: false
  };
  res.json({ data: settings });
});

router.put('/security', (req, res) => {
  const success = writeSettings('security-settings.json', req.body);
  if (success) {
    res.json({ message: 'Paramètres de sécurité sauvegardés' });
  } else {
    res.status(500).json({ error: 'Erreur lors de la sauvegarde de la sécurité' });
  }
});

// Routes pour les paramètres de sauvegarde
router.get('/backup', (req, res) => {
  const settings = readSettings('backup-settings.json') || {
    enableAutoBackup: true,
    backupTime: '23:58',
    adminEmail: 'vianey.jean@ymail.com',
    backupFrequency: 'daily'
  };
  res.json({ data: settings });
});

router.put('/backup', (req, res) => {
  const success = writeSettings('backup-settings.json', req.body);
  if (success) {
    res.json({ message: 'Paramètres de sauvegarde sauvegardés' });
  } else {
    res.status(500).json({ error: 'Erreur lors de la sauvegarde des paramètres de sauvegarde' });
  }
});

// Configurer la sauvegarde automatique
router.post('/backup/configure', (req, res) => {
  try {
    const backupSettings = req.body;
    const smtpSettings = readSettings('smtp-settings.json');
    
    const result = backupService.configureAutoBackup(backupSettings, smtpSettings);
    
    res.json({ message: 'Sauvegarde automatique configurée avec succès' });
  } catch (error) {
    console.error('Erreur configuration sauvegarde:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la configuration de la sauvegarde',
      details: error.message 
    });
  }
});

// Déclencher une sauvegarde manuelle
router.post('/backup/manual', async (req, res) => {
  try {
    const result = await backupService.createBackup();
    const backupSettings = readSettings('backup-settings.json');
    
    if (result.success && backupSettings && backupSettings.adminEmail) {
      await backupService.sendBackupByEmail(result.backupData, backupSettings.adminEmail);
    }
    
    res.json({ message: 'Sauvegarde manuelle effectuée', backupId: result.backupData.backupId });
  } catch (error) {
    console.error('Erreur sauvegarde manuelle:', error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde manuelle' });
  }
});

// Routes pour les paramètres de notification
router.get('/notifications', (req, res) => {
  const settings = readSettings('notification-settings.json') || {
    orderNotifications: true,
    lowStockAlerts: true,
    newUserNotifications: true,
    systemAlerts: true
  };
  res.json({ data: settings });
});

router.put('/notifications', (req, res) => {
  const success = writeSettings('notification-settings.json', req.body);
  if (success) {
    res.json({ message: 'Paramètres de notification sauvegardés' });
  } else {
    res.status(500).json({ error: 'Erreur lors de la sauvegarde des notifications' });
  }
});

module.exports = router;
