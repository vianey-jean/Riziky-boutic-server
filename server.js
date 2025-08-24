
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const setupRoutes = require('./config/routes');

const app = express();
const PORT = process.env.PORT || 10000;

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:8080',
  credentials: true
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers uploads statiquement
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// S'assurer que les dossiers uploads existent
const uploadsDir = path.join(__dirname, 'uploads');
const profileImagesDir = path.join(uploadsDir, 'profile-images');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(profileImagesDir)) {
  fs.mkdirSync(profileImagesDir, { recursive: true });
}

// Routes
setupRoutes(app);

// Route de test
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Gestion des erreurs 404
app.use((req, res) => {
  console.log('Route not found:', req.method, req.url);
  res.status(404).json({ message: 'Route not found' });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Server error', error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
});
