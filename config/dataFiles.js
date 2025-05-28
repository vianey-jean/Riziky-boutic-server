
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
];

const initializeDataFiles = (req, res, next) => {
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

  next();
};

module.exports = {
  dataFiles,
  initializeDataFiles
};
