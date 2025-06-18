const database = require('../core/database');
const path = require('path');

class FlashSaleService {
  constructor() {
    this.flashSalesFile = 'flash-sales.json';
    this.productsFile = 'products.json';
    this.banniereFile = 'banniereflashsale.json';
    
    // S'assurer que tous les fichiers existent
    this.initializeFiles();
  }

  initializeFiles() {
    database.ensureFile(this.flashSalesFile, []);
    database.ensureFile(this.productsFile, []);
    database.ensureFile(this.banniereFile, []);
  }

  getAllFlashSales() {
    try {
      const flashSales = database.read(this.flashSalesFile);
      return Array.isArray(flashSales) ? flashSales : [];
    } catch (error) {
      console.error('Erreur lors de la lecture des ventes flash:', error);
      return [];
    }
  }

  getFlashSaleById(id) {
    try {
      const flashSales = this.getAllFlashSales();
      return flashSales.find(sale => sale.id === id) || null;
    } catch (error) {
      console.error('Erreur lors de la recherche de vente flash:', error);
      return null;
    }
  }

  getActiveFlashSales() {
    try {
      console.log('🔍 Recherche des ventes flash actives...');
      
      const flashSales = this.getAllFlashSales();
      console.log('📦 Toutes les ventes flash:', flashSales);
      
      const now = new Date();
      console.log('🕒 Date actuelle:', now.toISOString());
      
      const activeFlashSales = flashSales.filter(sale => {
        console.log(`🔎 Vérification vente flash "${sale.title}":`);
        console.log(`  - isActive: ${sale.isActive}`);
        console.log(`  - startDate: ${sale.startDate}`);
        console.log(`  - endDate: ${sale.endDate}`);
        
        const startDate = new Date(sale.startDate);
        const endDate = new Date(sale.endDate);
        
        console.log(`  - startDate parsed: ${startDate.toISOString()}`);
        console.log(`  - endDate parsed: ${endDate.toISOString()}`);
        console.log(`  - Dans la période: ${startDate <= now && endDate > now}`);
        
        const isInPeriod = startDate <= now && endDate > now;
        const isActive = sale.isActive && isInPeriod;
        
        console.log(`  - Résultat final: ${isActive}`);
        
        return isActive;
      });
      
      console.log(`✅ ${activeFlashSales.length} ventes flash actives trouvées`);
      
      // Trier par ordre
      const sortedFlashSales = activeFlashSales.sort((a, b) => (a.order || 999) - (b.order || 999));
      
      console.log('📋 Ventes flash actives triées:', sortedFlashSales.map(s => ({ id: s.id, title: s.title, order: s.order })));
      
      return sortedFlashSales;
    } catch (error) {
      console.error('💥 Erreur lors de la recherche des ventes flash actives:', error);
      return [];
    }
  }

  getActiveFlashSale() {
    try {
      this.cleanExpiredFlashSales();
      const flashSales = this.getAllFlashSales();
      const now = new Date();
      
      const activeFlashSale = flashSales.find(sale => 
        sale.isActive && 
        new Date(sale.startDate) <= now && 
        new Date(sale.endDate) > now
      );
      
      return activeFlashSale || null;
    } catch (error) {
      console.error('Erreur lors de la recherche de vente flash active:', error);
      return null;
    }
  }

  createFlashSale(data) {
    try {
      const flashSales = this.getAllFlashSales();
      
      // S'assurer que productIds est un array de strings
      let processedProductIds = [];
      if (Array.isArray(data.productIds)) {
        processedProductIds = data.productIds.map(id => String(id));
      } else if (data.productIds && typeof data.productIds === 'object') {
        processedProductIds = Object.values(data.productIds).map(id => String(id));
      }
      
      const newFlashSale = {
        id: Date.now().toString(),
        title: data.title,
        description: data.description,
        discount: parseInt(data.discount),
        startDate: data.startDate,
        endDate: data.endDate,
        productIds: processedProductIds,
        isActive: false,
        createdAt: new Date().toISOString(),
        backgroundColor: data.backgroundColor || '',
        icon: data.icon || '',
        emoji: data.emoji || '',
        order: parseInt(data.order) || 1
      };
      
      flashSales.push(newFlashSale);
      database.write(this.flashSalesFile, flashSales);
      
      return newFlashSale;
    } catch (error) {
      console.error('Erreur lors de la création de vente flash:', error);
      throw error;
    }
  }

  updateFlashSale(id, updateData) {
    try {
      const flashSales = this.getAllFlashSales();
      const index = flashSales.findIndex(sale => sale.id === id);
      
      if (index === -1) {
        return null;
      }
      
      // S'assurer que productIds est un array de strings
      if (updateData.productIds) {
        if (Array.isArray(updateData.productIds)) {
          updateData.productIds = updateData.productIds.map(id => String(id));
        } else if (typeof updateData.productIds === 'object') {
          updateData.productIds = Object.values(updateData.productIds).map(id => String(id));
        }
      }
      
      // Traiter les nouvelles propriétés
      if (updateData.order) {
        updateData.order = parseInt(updateData.order);
      }
      
      flashSales[index] = { ...flashSales[index], ...updateData };
      database.write(this.flashSalesFile, flashSales);
      
      return flashSales[index];
    } catch (error) {
      console.error('Erreur lors de la mise à jour de vente flash:', error);
      throw error;
    }
  }

  deleteFlashSale(id) {
    try {
      const flashSales = this.getAllFlashSales();
      const filteredFlashSales = flashSales.filter(sale => sale.id !== id);
      
      if (filteredFlashSales.length === flashSales.length) {
        return false;
      }
      
      database.write(this.flashSalesFile, filteredFlashSales);
      this.generateBanniereFlashSale();
      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression de vente flash:', error);
      throw error;
    }
  }

  activateFlashSale(id) {
    try {
      const flashSales = this.getAllFlashSales();
      
      // Activer la vente flash sélectionnée
      const index = flashSales.findIndex(sale => sale.id === id);
      if (index === -1) {
        return null;
      }
      
      flashSales[index].isActive = true;
      database.write(this.flashSalesFile, flashSales);
      
      // Régénérer le fichier bannière
      this.generateBanniereFlashSale();
      
      return flashSales[index];
    } catch (error) {
      console.error('Erreur lors de l\'activation de vente flash:', error);
      throw error;
    }
  }

  deactivateFlashSale(id) {
    try {
      const flashSales = this.getAllFlashSales();
      const index = flashSales.findIndex(sale => sale.id === id);
      
      if (index === -1) {
        return null;
      }
      
      flashSales[index].isActive = false;
      database.write(this.flashSalesFile, flashSales);
      
      // Régénérer le fichier bannière
      this.generateBanniereFlashSale();
      
      return flashSales[index];
    } catch (error) {
      console.error('Erreur lors de la désactivation de vente flash:', error);
      throw error;
    }
  }

  getProducts() {
    try {
      const products = database.read(this.productsFile);
      return Array.isArray(products) ? products : [];
    } catch (error) {
      console.error('Erreur lors de la lecture des produits:', error);
      return [];
    }
  }

  getFlashSaleProducts(flashSaleId) {
    try {
      const flashSale = this.getFlashSaleById(flashSaleId);
      if (!flashSale) {
        return [];
      }
      
      const products = this.getProducts();
      const flashSaleProducts = products.filter(product => 
        flashSale.productIds && flashSale.productIds.includes(product.id)
      );
      
      return flashSaleProducts;
    } catch (error) {
      console.error('Erreur lors de la récupération des produits de vente flash:', error);
      return [];
    }
  }

  generateBanniereFlashSale() {
    try {
      console.log('🔄 Génération du fichier banniereflashsale.json...');
      
      const activeFlashSales = this.getActiveFlashSales();
      
      if (!activeFlashSales || activeFlashSales.length === 0) {
        console.log('ℹ️ Aucune vente flash active trouvée');
        database.write(this.banniereFile, []);
        return [];
      }
      
      console.log('✅ Ventes flash actives trouvées:', activeFlashSales.length);
      
      const allProducts = this.getProducts();
      console.log('📦 Nombre de produits dans la base:', allProducts.length);
      
      const banniereProducts = [];
      
      // Traiter chaque vente flash active
      activeFlashSales.forEach(flashSale => {
        const productIds = flashSale.productIds.map(id => id.toString().trim());
        console.log(`🎯 IDs des produits à traiter pour ${flashSale.title}:`, productIds);
        
        productIds.forEach(targetId => {
          const foundProduct = allProducts.find(product => 
            product.id.toString().trim() === targetId
          );
          
          if (foundProduct) {
            console.log(`✅ Produit trouvé: ${foundProduct.name}`);
            
            const banniereProduct = {
              ...foundProduct,
              flashSaleId: flashSale.id,
              flashSaleDiscount: flashSale.discount,
              flashSaleStartDate: flashSale.startDate,
              flashSaleEndDate: flashSale.endDate,
              flashSaleTitle: flashSale.title,
              flashSaleDescription: flashSale.description,
              flashSaleBackgroundColor: flashSale.backgroundColor,
              flashSaleIcon: flashSale.icon,
              flashSaleEmoji: flashSale.emoji,
              flashSaleOrder: flashSale.order,
              originalFlashPrice: foundProduct.price,
              flashSalePrice: +(foundProduct.price * (1 - flashSale.discount / 100)).toFixed(2)
            };
            
            banniereProducts.push(banniereProduct);
          } else {
            console.log(`❌ Aucun produit trouvé pour l'ID: ${targetId}`);
          }
        });
      });
      
      console.log(`📝 ${banniereProducts.length} produits ajoutés au fichier banniere`);
      
      database.write(this.banniereFile, banniereProducts);
      console.log('✅ Fichier banniereflashsale.json généré avec succès');
      
      return banniereProducts;
    } catch (error) {
      console.error('💥 Erreur lors de la génération du fichier banniereflashsale.json:', error);
      database.write(this.banniereFile, []);
      return [];
    }
  }

  getBanniereProducts() {
    try {
      // Toujours régénérer avant de servir pour garantir la fraîcheur des données
      return this.generateBanniereFlashSale();
    } catch (error) {
      console.error('Erreur lors de la récupération des produits bannière:', error);
      return [];
    }
  }

  cleanExpiredFlashSales() {
    try {
      const flashSales = this.getAllFlashSales();
      const now = new Date();
      
      const activeFlashSales = flashSales.filter(sale => {
        const endDate = new Date(sale.endDate);
        return endDate > now;
      });
      
      if (activeFlashSales.length !== flashSales.length) {
        database.write(this.flashSalesFile, activeFlashSales);
        console.log(`🧹 ${flashSales.length - activeFlashSales.length} ventes flash expirées supprimées`);
        
        // Régénérer le fichier bannière après nettoyage
        this.generateBanniereFlashSale();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erreur lors du nettoyage des ventes flash expirées:', error);
      return false;
    }
  }
}

module.exports = new FlashSaleService();
