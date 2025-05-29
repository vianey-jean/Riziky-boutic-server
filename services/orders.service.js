
const database = require('../core/database');

class OrdersService {
  constructor() {
    this.ordersFile = 'orders.json';
    this.commandesFile = 'commandes.json'; // Backward compatibility
  }

  getAll() {
    return database.read(this.ordersFile);
  }

  getUserOrders(userId) {
    const orders = this.getAll();
    return orders.filter(order => order.userId === userId);
  }

  getById(orderId) {
    const orders = this.getAll();
    return orders.find(order => order.id === orderId);
  }

  create(orderData) {
    const orders = this.getAll();
    const newOrder = {
      id: `ORD-${Date.now()}`,
      ...orderData,
      status: 'en attente',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    orders.push(newOrder);
    database.write(this.ordersFile, orders);
    
    // Backward compatibility
    database.write(this.commandesFile, orders);
    
    return newOrder;
  }

  updateStatus(orderId, status) {
    const orders = this.getAll();
    const orderIndex = orders.findIndex(order => order.id === orderId);
    
    if (orderIndex === -1) return null;

    orders[orderIndex].status = status;
    orders[orderIndex].updatedAt = new Date().toISOString();
    
    database.write(this.ordersFile, orders);
    database.write(this.commandesFile, orders);
    
    return orders[orderIndex];
  }

  cancelOrder(orderId, itemsToCancel) {
    const order = this.getById(orderId);
    if (!order) return null;

    if (itemsToCancel && itemsToCancel.length > 0) {
      order.items = order.items.filter(item => !itemsToCancel.includes(item.productId));
    }
    
    const updatedOrder = this.updateStatus(orderId, 'annulée');
    return updatedOrder;
  }
}

module.exports = new OrdersService();
