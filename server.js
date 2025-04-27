
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuration pour les uploads d'images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Création du dossier uploads s'il n'existe pas
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Création des fichiers JSON s'ils n'existent pas
const dataFiles = [
  'users.json', 
  'products.json', 
  'panier.json', 
  'favorites.json', 
  'contacts.json',
  'commandes.json',
  'admin-chat.json'
];

dataFiles.forEach(file => {
  const filePath = path.join(__dirname, 'data', file);
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    const initialData = file === 'admin-chat.json' ? { conversations: {} } : [];
    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
  }
});

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/panier', require('./routes/panier'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin-chat', require('./routes/admin-chat'));

// Route pour les images uploadées
app.use('/uploads', express.static('uploads'));

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
