
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');

// Route publique pour vérifier les paramètres (pas d'authentification requise)
router.get('/general', (req, res) => {
  try {
    // Lire le fichier maintenance.json
    const maintenancePath = path.join(dataDir, 'maintenance.json');
    let maintenanceMode = false;
    if (fs.existsSync(maintenancePath)) {
      const maintenanceData = JSON.parse(fs.readFileSync(maintenancePath, 'utf8'));
      maintenanceMode = maintenanceData.maintenance || false;
    }

    // Lire le fichier inscription.json
    const inscriptionPath = path.join(dataDir, 'inscription.json');
    let allowRegistration = true;
    if (fs.existsSync(inscriptionPath)) {
      const inscriptionData = JSON.parse(fs.readFileSync(inscriptionPath, 'utf8'));
      allowRegistration = inscriptionData.inscription || false;
    }

    // Retourner les paramètres publics
    const settings = {
      maintenanceMode,
      allowRegistration,
      siteName: 'Riziky Boutic',
      siteDescription: 'Boutique e-commerce de qualité'
    };

    res.json(settings);
  } catch (error) {
    console.error('Erreur lecture paramètres publics:', error);
    // En cas d'erreur, retourner des valeurs par défaut sécurisées
    res.json({
      maintenanceMode: false,
      allowRegistration: true,
      siteName: 'Riziky Boutic',
      siteDescription: 'Boutique e-commerce de qualité'
    });
  }
});

module.exports = router;
