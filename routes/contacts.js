
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { isAuthenticated, isAdmin } = require('../middlewares/auth');

const contactsFilePath = path.join(__dirname, '../data/contacts.json');

// Obtenir tous les contacts (admin seulement)
router.get('/', isAuthenticated, isAdmin, (req, res) => {
  try {
    const contacts = JSON.parse(fs.readFileSync(contactsFilePath));
    // Trier par non-lu d'abord, puis par date (plus récent d'abord)
    contacts.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.dateCreation) - new Date(a.dateCreation);
    });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des contacts' });
  }
});

// Obtenir un contact par ID (admin seulement)
router.get('/:id', isAuthenticated, isAdmin, (req, res) => {
  try {
    const contacts = JSON.parse(fs.readFileSync(contactsFilePath));
    const contact = contacts.find(c => c.id === req.params.id);
    
    if (!contact) {
      return res.status(404).json({ message: 'Contact non trouvé' });
    }
    
    res.json(contact);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du contact' });
  }
});

// Ajouter un nouveau contact (public)
router.post('/', (req, res) => {
  try {
    const contacts = JSON.parse(fs.readFileSync(contactsFilePath));
    const newContact = {
      id: `contact-${Date.now()}`,
      ...req.body,
      dateCreation: new Date().toISOString(),
      read: false
    };
    
    contacts.push(newContact);
    fs.writeFileSync(contactsFilePath, JSON.stringify(contacts, null, 2));
    
    res.status(201).json(newContact);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'ajout du contact' });
  }
});

// Mettre à jour un contact (admin seulement)
router.put('/:id', isAuthenticated, isAdmin, (req, res) => {
  try {
    const contacts = JSON.parse(fs.readFileSync(contactsFilePath));
    const index = contacts.findIndex(c => c.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Contact non trouvé' });
    }
    
    contacts[index] = {
      ...contacts[index],
      ...req.body,
      id: req.params.id // S'assurer que l'ID ne change pas
    };
    
    fs.writeFileSync(contactsFilePath, JSON.stringify(contacts, null, 2));
    res.json(contacts[index]);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du contact' });
  }
});

// Supprimer un contact (admin seulement)
router.delete('/:id', isAuthenticated, isAdmin, (req, res) => {
  try {
    const contacts = JSON.parse(fs.readFileSync(contactsFilePath));
    const filteredContacts = contacts.filter(c => c.id !== req.params.id);
    
    if (filteredContacts.length === contacts.length) {
      return res.status(404).json({ message: 'Contact non trouvé' });
    }
    
    fs.writeFileSync(contactsFilePath, JSON.stringify(filteredContacts, null, 2));
    res.json({ message: 'Contact supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du contact' });
  }
});

module.exports = router;
