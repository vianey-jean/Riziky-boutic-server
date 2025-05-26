
const authRoutes = require('../routes/auth');
const productRoutes = require('../routes/products');
const panierRoutes = require('../routes/panier');
const favoriteRoutes = require('../routes/favorites');
const orderRoutes = require('../routes/orders');
const contactRoutes = require('../routes/contacts');
const clientChatRoutes = require('../routes/client-chat');
const adminChatRoutes = require('../routes/admin-chat');
const usersRoutes = require('../routes/users');
const reviewRoutes = require('../routes/reviews');
const codePromoRoutes = require('../routes/code-promos');
const pubLayoutRoutes = require('../routes/pub-layout');
const remboursementRoutes = require('../routes/remboursements');

const setupRoutes = (app) => {
  // Routes de l'API
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/panier', panierRoutes);
  app.use('/api/favorites', favoriteRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/contacts', contactRoutes);
  app.use('/api/client-chat', clientChatRoutes);
  app.use('/api/admin-chat', adminChatRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/code-promos', codePromoRoutes);
  app.use('/api/pub-layout', pubLayoutRoutes);
  app.use('/api/remboursements', remboursementRoutes);
};

module.exports = setupRoutes;
