
const database = require('../core/database');

class CartService {
  constructor() {
    this.cartFile = 'panier.json';
  }

  getUserCart(userId) {
    const carts = database.read(this.cartFile);
    return carts.find(cart => cart.userId === userId) || { userId, items: [] };
  }

  addItem(userId, productId, quantity = 1) {
    const carts = database.read(this.cartFile);
    let userCart = carts.find(cart => cart.userId === userId);
    
    if (!userCart) {
      userCart = { userId, items: [] };
      carts.push(userCart);
    }

    const existingItem = userCart.items.find(item => item.productId === productId);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      userCart.items.push({ productId, quantity, price: 0 });
    }

    database.write(this.cartFile, carts);
    return userCart;
  }

  updateItem(userId, productId, quantity) {
    const carts = database.read(this.cartFile);
    const userCart = carts.find(cart => cart.userId === userId);
    
    if (!userCart) return null;

    const item = userCart.items.find(item => item.productId === productId);
    if (!item) return null;

    if (quantity <= 0) {
      userCart.items = userCart.items.filter(item => item.productId !== productId);
    } else {
      item.quantity = quantity;
    }

    database.write(this.cartFile, carts);
    return userCart;
  }

  removeItem(userId, productId) {
    const carts = database.read(this.cartFile);
    const userCart = carts.find(cart => cart.userId === userId);
    
    if (!userCart) return null;

    userCart.items = userCart.items.filter(item => item.productId !== productId);
    database.write(this.cartFile, carts);
    return userCart;
  }

  clearCart(userId) {
    const carts = database.read(this.cartFile);
    const userCart = carts.find(cart => cart.userId === userId);
    
    if (!userCart) return null;

    userCart.items = [];
    database.write(this.cartFile, carts);
    return userCart;
  }
}

module.exports = new CartService();
