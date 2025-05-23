
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Chemin vers le fichier JSON des publicités
const pubLayoutFile = path.join(__dirname, '../data/publayout.json');

// Middleware pour vérifier si le fichier existe, sinon le créer
const ensureFileExists = (req, res, next) => {
  if (!fs.existsSync(pubLayoutFile)) {
    fs.writeFileSync(pubLayoutFile, JSON.stringify([]), 'utf8');
  }
  next();
};

// Obtenir toutes les publicités
router.get('/', ensureFileExists, (req, res) => {
  try {
    const pubData = JSON.parse(fs.readFileSync(pubLayoutFile, 'utf8'));
    res.json(pubData);
  } catch (error) {
    console.error('Erreur lors de la récupération des publicités:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des publicités' });
  }
});

// Ajouter une nouvelle publicité
router.post('/', ensureFileExists, (req, res) => {
  try {
    const { icon, text } = req.body;

    // Validation
    if (!icon || !text) {
      return res.status(400).json({ message: 'L\'icône et le texte sont requis' });
    }

    const pubData = JSON.parse(fs.readFileSync(pubLayoutFile, 'utf8'));

    // Vérifier le nombre maximum de publicités (6)
    if (pubData.length >= 6) {
      return res.status(400).json({ message: 'Le nombre maximum de publicités (6) est atteint' });
    }

    // Créer une nouvelle publicité
    const newPub = {
      id: uuidv4(),
      icon,
      text
    };

    // Ajouter à la liste
    pubData.push(newPub);
    fs.writeFileSync(pubLayoutFile, JSON.stringify(pubData, null, 2), 'utf8');

    res.status(201).json(newPub);
  } catch (error) {
    console.error('Erreur lors de l\'ajout d\'une publicité:', error);
    res.status(500).json({ message: 'Erreur serveur lors de l\'ajout d\'une publicité' });
  }
});

// Mettre à jour une publicité existante
router.put('/:id', ensureFileExists, (req, res) => {
  try {
    const { id } = req.params;
    const { icon, text } = req.body;

    // Validation
    if (!icon || !text) {
      return res.status(400).json({ message: 'L\'icône et le texte sont requis' });
    }

    let pubData = JSON.parse(fs.readFileSync(pubLayoutFile, 'utf8'));
    const pubIndex = pubData.findIndex(pub => pub.id === id);

    if (pubIndex === -1) {
      return res.status(404).json({ message: 'Publicité non trouvée' });
    }

    // Mettre à jour la publicité
    pubData[pubIndex] = {
      ...pubData[pubIndex],
      icon,
      text
    };

    fs.writeFileSync(pubLayoutFile, JSON.stringify(pubData, null, 2), 'utf8');
    res.json(pubData[pubIndex]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour d\'une publicité:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la mise à jour d\'une publicité' });
  }
});

// Supprimer une publicité
router.delete('/:id', ensureFileExists, (req, res) => {
  try {
    const { id } = req.params;
    let pubData = JSON.parse(fs.readFileSync(pubLayoutFile, 'utf8'));
    
    // Vérifier si nous avons au moins 3 publicités avant de supprimer
    if (pubData.length <= 2) {
      return res.status(400).json({ message: 'Il faut conserver au moins 2 publicités' });
    }
    
    const initialLength = pubData.length;
    pubData = pubData.filter(pub => pub.id !== id);

    if (pubData.length === initialLength) {
      return res.status(404).json({ message: 'Publicité non trouvée' });
    }

    fs.writeFileSync(pubLayoutFile, JSON.stringify(pubData, null, 2), 'utf8');
    res.json({ message: 'Publicité supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression d\'une publicité:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la suppression d\'une publicité' });
  }
});

module.exports = router;
