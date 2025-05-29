
const database = require('../core/database');

class ProductsService {
  constructor() {
    this.productsFile = 'products.json';
  }

  getAll() {
    return database.read(this.productsFile);
  }

  getById(id) {
    const products = this.getAll();
    return products.find(product => product.id === id);
  }

  getByCategory(category) {
    const products = this.getAll();
    return products.filter(product => 
      product.category.toLowerCase() === category.toLowerCase()
    );
  }

  getMostFavorited() {
    const products = this.getAll();
    const favorites = database.read('favorites.json');
    
    const productFavCounts = {};
    favorites.forEach(fav => {
      productFavCounts[fav.productId] = (productFavCounts[fav.productId] || 0) + 1;
    });
    
    return products
      .map(product => ({
        ...product,
        favoriteCount: productFavCounts[product.id] || 0
      }))
      .sort((a, b) => b.favoriteCount - a.favoriteCount)
      .slice(0, 10);
  }

  getNewArrivals() {
    const products = this.getAll();
    return products
      .sort((a, b) => new Date(b.dateAjout) - new Date(a.dateAjout))
      .slice(0, 12);
  }

  create(productData) {
    const products = this.getAll();
    const newProduct = {
      id: Date.now().toString(),
      ...productData,
      dateAjout: new Date().toISOString()
    };

    products.push(newProduct);
    database.write(this.productsFile, products);
    return newProduct;
  }

  update(id, updateData) {
    const products = this.getAll();
    const productIndex = products.findIndex(product => product.id === id);
    
    if (productIndex === -1) return null;

    products[productIndex] = { ...products[productIndex], ...updateData };
    database.write(this.productsFile, products);
    return products[productIndex];
  }

  delete(id) {
    const products = this.getAll();
    const filteredProducts = products.filter(product => product.id !== id);
    
    if (filteredProducts.length === products.length) return false;
    
    database.write(this.productsFile, filteredProducts);
    return true;
  }

  search(query) {
    const products = this.getAll();
    const searchTerm = query.toLowerCase();
    
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm) ||
      product.description.toLowerCase().includes(searchTerm) ||
      product.category.toLowerCase().includes(searchTerm)
    );
  }

  applyPromotion(id, promotion, duration) {
    const product = this.getById(id);
    if (!product) return null;

    const promotionEnd = new Date();
    promotionEnd.setHours(promotionEnd.getHours() + duration);

    const updatedProduct = this.update(id, {
      promotion,
      promotionEnd: promotionEnd.toISOString(),
      originalPrice: product.originalPrice || product.price
    });

    return updatedProduct;
  }
}

module.exports = new ProductsService();
