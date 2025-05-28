
const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('../config/auth');
const router = express.Router();

const categoriesFilePath = path.join(__dirname, '../data/categories.json');

// Fonction utilitaire pour lire les catégories
const readCategories = () => {
  try {
    if (!fs.existsSync(categoriesFilePath)) {
      return [];
    }
    const data = fs.readFileSync(categoriesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur lors de la lecture des catégories:', error);
    return [];
  }
};

// Fonction utilitaire pour écrire les catégories
const writeCategories = (categories) => {
  try {
    fs.writeFileSync(categoriesFilePath, JSON.stringify(categories, null, 2));
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'écriture des catégories:', error);
    return false;
  }
};

// GET /api/categories - Récupérer toutes les catégories
router.get('/', (req, res) => {
  try {
    const categories = readCategories();
    // Trier par ordre croissant
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json(categories);
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/categories/active - Récupérer seulement les catégories actives
router.get('/active', (req, res) => {
  try {
    const categories = readCategories();
    const activeCategories = categories
      .filter(cat => cat.isActive)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json(activeCategories);
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories actives:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/categories/:id - Récupérer une catégorie par ID
router.get('/:id', (req, res) => {
  try {
    const categories = readCategories();
    const category = categories.find(cat => cat.id === req.params.id);
    
    if (!category) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('Erreur lors de la récupération de la catégorie:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/categories - Créer une nouvelle catégorie (Admin seulement)
router.post('/', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { name, description, order, isActive = true } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Le nom de la catégorie est requis' });
    }

    const categories = readCategories();
    
    // Vérifier si la catégorie existe déjà
    const existingCategory = categories.find(cat => 
      cat.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingCategory) {
      return res.status(400).json({ error: 'Cette catégorie existe déjà' });
    }

    const newCategory = {
      id: Date.now().toString(),
      name: name.trim(),
      description: description || '',
      order: order || categories.length + 1,
      isActive,
      createdAt: new Date().toISOString()
    };

    categories.push(newCategory);

    if (writeCategories(categories)) {
      res.status(201).json(newCategory);
    } else {
      res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
    }
  } catch (error) {
    console.error('Erreur lors de la création de la catégorie:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/categories/:id - Mettre à jour une catégorie (Admin seulement)
router.put('/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { name, description, order, isActive } = req.body;
    const categories = readCategories();
    const categoryIndex = categories.findIndex(cat => cat.id === req.params.id);

    if (categoryIndex === -1) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    // Vérifier si le nouveau nom existe déjà (sauf pour la catégorie actuelle)
    if (name) {
      const existingCategory = categories.find(cat => 
        cat.name.toLowerCase() === name.toLowerCase() && cat.id !== req.params.id
      );
      
      if (existingCategory) {
        return res.status(400).json({ error: 'Cette catégorie existe déjà' });
      }
    }

    const updatedCategory = {
      ...categories[categoryIndex],
      ...(name && { name: name.trim() }),
      ...(description !== undefined && { description }),
      ...(order !== undefined && { order }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date().toISOString()
    };

    categories[categoryIndex] = updatedCategory;

    if (writeCategories(categories)) {
      res.json(updatedCategory);
    } else {
      res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la catégorie:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/categories/:id - Supprimer une catégorie (Admin seulement)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const categories = readCategories();
    const categoryIndex = categories.findIndex(cat => cat.id === req.params.id);

    if (categoryIndex === -1) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    categories.splice(categoryIndex, 1);

    if (writeCategories(categories)) {
      res.json({ message: 'Catégorie supprimée avec succès' });
    } else {
      res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
    }
  } catch (error) {
    console.error('Erreur lors de la suppression de la catégorie:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
