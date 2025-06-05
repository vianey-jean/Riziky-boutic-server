const { initializeDataFiles } = require('./dataFiles');

const setupRoutes = (app) => {
  // Initialiser les fichiers de données
  const fs = require('fs');
  const path = require('path');

  const dataFiles = [
    'users.json',
    'products.json',
    'panier.json',
    'favorites.json',
    'orders.json',
    'contacts.json',
    'client-chat.json',
    'admin-chat.json',
    'preferences.json',
    'reviews.json',
    'reset-codes.json',
    'publayout.json',
    'remboursements.json',
    'banniereflashsale.json',
    'categories.json',
    'visitors.json',
    'sales-notifications.json',
    'general-settings.json',
    'smtp-settings.json',
    'payment-settings.json',
    'shipping-settings.json',
    'security-settings.json',
    'backup-settings.json',
    'notification-settings.json',
    'backups-info.json'
  ];

  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  dataFiles.forEach(file => {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([]));
    }
  });

  // Routes principales
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/products', require('../routes/products'));
  app.use('/api/categories', require('../routes/categories'));
  app.use('/api/panier', require('../routes/panier'));
  app.use('/api/favorites', require('../routes/favorites'));
  app.use('/api/orders', require('../routes/orders'));
  app.use('/api/contacts', require('../routes/contacts'));
  app.use('/api/users', require('../routes/users'));
  app.use('/api/reviews', require('../routes/reviews'));
  app.use('/api/flash-sales', require('../routes/flash-sales'));
  app.use('/api/pub-layout', require('../routes/pub-layout'));
  app.use('/api/code-promos', require('../routes/code-promos'));
  app.use('/api/remboursements', require('../routes/remboursements'));
  app.use('/api/client-chat', require('../routes/client-chat'));
  app.use('/api/admin-chat', require('../routes/admin-chat'));
  app.use('/api/visitors', require('../routes/visitors'));
  app.use('/api/sales-notifications', require('../routes/sales-notifications'));
  app.use('/api/settings', require('../routes/settings'));

  // Route publique pour les paramètres (accessible sans authentification)
  app.use('/api/public-settings', require('../routes/public-settings'));
};

module.exports = setupRoutes;
