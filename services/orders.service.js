
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
    
    // Enregistrer la notification de vente pour chaque produit
    this.recordSalesNotifications(newOrder);
    
    return newOrder;
  }

  recordSalesNotifications(order) {
    try {
      const salesNotifications = database.read('sales-notifications.json');
      const now = new Date();
      
      // Créer une notification pour chaque produit dans la commande
      order.items.forEach(item => {
        const notification = {
          id: `sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          customerName: `${order.userName || 'Client'}`,
          productId: item.productId,
          name: item.name,
          price: item.price,
          originalPrice: item.originalPrice || item.price,
          quantity: item.quantity,
          image: item.image,
          subtotal: item.subtotal,
          orderId: order.id,
          location: order.shippingAddress?.ville || 'France',
          timestamp: now.toISOString(),
          date: now.toLocaleDateString('fr-FR'),
          time: now.toLocaleTimeString('fr-FR'),
          timeAgo: 'à l\'instant'
        };

        salesNotifications.unshift(notification);
      });
      
      // Garder seulement les 100 dernières notifications
      if (salesNotifications.length > 100) {
        salesNotifications.splice(100);
      }

      database.write('sales-notifications.json', salesNotifications);
      console.log(`Notifications de vente enregistrées pour la commande ${order.id}`);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement des notifications de vente:', error);
    }
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
