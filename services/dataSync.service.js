
const database = require('../core/database');

class DataSyncService {
  constructor() {
    this.subscribers = new Map();
    this.dataFiles = [
      'flash-sales.json',
      'products.json',
      'banniereflashsale.json',
      'users.json',
      'orders.json',
      'admin-chat.json',
      'client-chat.json'
    ];
  }

  // Abonner un client aux changements de données
  subscribe(clientId, callback) {
    this.subscribers.set(clientId, callback);
    console.log(`📡 Client ${clientId} abonné aux mises à jour de données`);
  }

  // Désabonner un client
  unsubscribe(clientId) {
    this.subscribers.delete(clientId);
    console.log(`📡 Client ${clientId} désabonné des mises à jour de données`);
  }

  // Notifier tous les clients abonnés d'un changement
  notifyDataChange(dataType, data) {
    console.log(`📢 Notification de changement de données: ${dataType}`);
    
    const notification = {
      type: 'DATA_UPDATE',
      dataType,
      data,
      timestamp: new Date().toISOString()
    };

    this.subscribers.forEach((callback, clientId) => {
      try {
        callback(notification);
      } catch (error) {
        console.error(`Erreur lors de la notification du client ${clientId}:`, error);
        // Désabonner les clients en erreur
        this.unsubscribe(clientId);
      }
    });
  }

  // Vérifier l'intégrité des données
  validateDataIntegrity() {
    const report = {
      timestamp: new Date().toISOString(),
      files: {},
      errors: []
    };

    this.dataFiles.forEach(filename => {
      try {
        const data = database.read(filename);
        report.files[filename] = {
          exists: true,
          isArray: Array.isArray(data),
          itemCount: Array.isArray(data) ? data.length : typeof data === 'object' ? Object.keys(data).length : 0,
          lastModified: new Date().toISOString()
        };
      } catch (error) {
        report.errors.push({
          file: filename,
          error: error.message
        });
        report.files[filename] = {
          exists: false,
          error: error.message
        };
      }
    });

    return report;
  }

  // Synchroniser les données entre les fichiers
  syncData() {
    try {
      console.log('🔄 Début de la synchronisation des données');
      
      // Vérifier l'intégrité
      const integrityReport = this.validateDataIntegrity();
      
      // Réparer les fichiers manquants
      integrityReport.errors.forEach(error => {
        console.log(`🔧 Réparation du fichier: ${error.file}`);
        database.ensureFile(error.file, []);
      });

      // Notifier les changements
      this.notifyDataChange('SYNC_COMPLETE', {
        integrityReport,
        syncedAt: new Date().toISOString()
      });

      console.log('✅ Synchronisation des données terminée');
      return integrityReport;
    } catch (error) {
      console.error('💥 Erreur lors de la synchronisation des données:', error);
      throw error;
    }
  }

  // Obtenir les statistiques des données
  getDataStats() {
    try {
      const stats = {
        timestamp: new Date().toISOString(),
        files: {}
      };

      this.dataFiles.forEach(filename => {
        try {
          const data = database.read(filename);
          stats.files[filename] = {
            size: Array.isArray(data) ? data.length : typeof data === 'object' ? Object.keys(data).length : 1,
            type: Array.isArray(data) ? 'array' : typeof data,
            lastAccess: new Date().toISOString()
          };
        } catch (error) {
          stats.files[filename] = {
            error: error.message,
            accessible: false
          };
        }
      });

      return stats;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      throw error;
    }
  }

  // Nettoyer les données obsolètes
  cleanupData() {
    try {
      console.log('🧹 Début du nettoyage des données');
      
      let cleanupCount = 0;

      // Nettoyer les ventes flash expirées
      const flashSales = database.read('flash-sales.json');
      if (Array.isArray(flashSales)) {
        const now = new Date();
        const activeFlashSales = flashSales.filter(sale => {
          const endDate = new Date(sale.endDate);
          return endDate > now;
        });
        
        if (activeFlashSales.length !== flashSales.length) {
          database.write('flash-sales.json', activeFlashSales);
          cleanupCount += flashSales.length - activeFlashSales.length;
          console.log(`🗑️ ${flashSales.length - activeFlashSales.length} ventes flash expirées supprimées`);
        }
      }

      // Nettoyer les anciens logs de chat (plus de 30 jours)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      // Ici on pourrait ajouter d'autres nettoyages selon les besoins

      this.notifyDataChange('CLEANUP_COMPLETE', {
        itemsRemoved: cleanupCount,
        cleanupDate: new Date().toISOString()
      });

      console.log(`✅ Nettoyage terminé: ${cleanupCount} éléments supprimés`);
      return { itemsRemoved: cleanupCount };
    } catch (error) {
      console.error('💥 Erreur lors du nettoyage des données:', error);
      throw error;
    }
  }
}

module.exports = new DataSyncService();
