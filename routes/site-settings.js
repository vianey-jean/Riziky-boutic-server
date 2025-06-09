
const express = require('express');
const database = require('../core/database');
const router = express.Router();

// Obtenir tous les paramètres du site
router.get('/', (req, res) => {
  try {
    const settings = database.read('site-settings.json');
    res.json(settings);
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour une section spécifique des paramètres
router.put('/:section', (req, res) => {
  try {
    const { section } = req.params;
    const updates = req.body;
    
    const settings = database.read('site-settings.json');
    
    if (!settings[section]) {
      return res.status(404).json({ error: 'Section non trouvée' });
    }
    
    // Mettre à jour la section avec les nouvelles valeurs
    settings[section] = { ...settings[section], ...updates };
    
    // Sauvegarder dans la base de données
    database.write('site-settings.json', settings);
    
    console.log(`Paramètres mis à jour pour la section: ${section}`);
    res.json({ 
      message: 'Paramètres mis à jour avec succès',
      section: section,
      data: settings[section]
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Réinitialiser les paramètres par défaut
router.post('/reset', (req, res) => {
  try {
    const defaultSettings = {
      general: {
        siteName: "Mon E-commerce",
        siteDescription: "Votre boutique en ligne de confiance",
        companyName: "Ma Société E-commerce",
        contactEmail: "contact@monsite.com",
        supportEmail: "support@monsite.com",
        phone: "+33 1 23 45 67 89",
        address: "123 Rue du Commerce, 75001 Paris",
        language: "fr",
        currency: "EUR",
        timezone: "Europe/Paris"
      },
      appearance: {
        theme: "modern",
        primaryColor: "#3B82F6",
        secondaryColor: "#10B981",
        accentColor: "#F59E0B",
        logoUrl: "/images/logo/logo.png",
        faviconUrl: "/favicon.ico",
        bannerEnabled: true,
        bannerText: "Livraison gratuite à partir de 50€",
        headerStyle: "modern",
        footerStyle: "detailed"
      },
      ecommerce: {
        taxRate: 20,
        shippingFee: 5.99,
        freeShippingThreshold: 50,
        enableReviews: true,
        enableWishlist: true,
        enableCompare: true,
        stockManagement: true,
        autoReduceStock: true,
        lowStockThreshold: 5,
        outOfStockBehavior: "hide"
      },
      payment: {
        enableCreditCard: true,
        enablePaypal: true,
        enableBankTransfer: true,
        enableCash: false,
        stripeEnabled: false,
        stripePublicKey: "",
        paypalEnabled: false,
        paypalClientId: ""
      },
      shipping: {
        enableFreeShipping: true,
        enableExpressDelivery: true,
        expressDeliveryFee: 9.99,
        estimatedDeliveryDays: 3,
        enableInternationalShipping: false,
        internationalShippingFee: 15.99
      },
      notifications: {
        enableEmailNotifications: true,
        enableOrderConfirmation: true,
        enableShippingNotifications: true,
        enablePromotionalEmails: true,
        enableSmsNotifications: false,
        enablePushNotifications: false
      },
      seo: {
        metaTitle: "Mon E-commerce - Votre boutique en ligne",
        metaDescription: "Découvrez notre large gamme de produits de qualité avec livraison rapide",
        metaKeywords: "e-commerce, boutique en ligne, produits, livraison",
        googleAnalyticsId: "",
        facebookPixelId: "",
        enableSitemap: true,
        enableRobotsTxt: true
      },
      security: {
        enableSSL: true,
        enableCaptcha: false,
        captchaSiteKey: "",
        enableTwoFactorAuth: false,
        sessionTimeout: 24,
        passwordMinLength: 8,
        enableLoginAttemptLimit: true,
        maxLoginAttempts: 5
      },
      system: {
        registrationEnabled: true,
        maintenanceMode: false,
        maintenanceMessage: "Site en maintenance. Nous serons de retour très bientôt !"
      }
    };
    
    database.write('site-settings.json', defaultSettings);
    res.json({ message: 'Paramètres réinitialisés avec succès', data: defaultSettings });
  } catch (error) {
    console.error('Erreur lors de la réinitialisation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
