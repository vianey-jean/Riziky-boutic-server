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
        this.unsubscribe(clientId);
      }
    });
  }

  // Vérifier l'intégrité des données
  validateDataIntegrity() {
    const report = {
      timestamp: new Date().toISOString(),
      files: {},
      errors: [],
      summary: {
        totalFiles: this.dataFiles.length,
        validFiles: 0,
        corruptedFiles: 0,
        missingFiles: 0
      }
    };

    this.dataFiles.forEach(filename => {
      try {
        const data = database.read(filename);
        const fileStats = {
          exists: true,
          isArray: Array.isArray(data),
          itemCount: Array.isArray(data) ? data.length : typeof data === 'object' ? Object.keys(data).length : 0,
          lastModified: new Date().toISOString(),
          fileSize: JSON.stringify(data).length,
          isValid: true
        };

        // Validation spécifique par type de fichier
        if (filename === 'flash-sales.json' && Array.isArray(data)) {
          fileStats.activeFlashSales = data.filter(sale => sale.isActive).length;
          fileStats.expiredFlashSales = data.filter(sale => new Date(sale.endDate) < new Date()).length;
        }

        if (filename === 'products.json' && Array.isArray(data)) {
          fileStats.totalProducts = data.length;
          fileStats.activeProducts = data.filter(product => product.stock > 0).length;
        }

        report.files[filename] = fileStats;
        report.summary.validFiles++;
      } catch (error) {
        report.errors.push({
          file: filename,
          error: error.message,
          severity: 'high'
        });
        report.files[filename] = {
          exists: false,
          error: error.message,
          isValid: false
        };
        report.summary.missingFiles++;
      }
    });

    report.summary.corruptedFiles = report.errors.length;
    return report;
  }

  // Synchroniser les données entre les fichiers
  syncData() {
    try {
      console.log('🔄 Début de la synchronisation des données');
      
      const integrityReport = this.validateDataIntegrity();
      
      // Réparer les fichiers manquants avec des structures par défaut
      integrityReport.errors.forEach(error => {
        console.log(`🔧 Réparation du fichier: ${error.file}`);
        const defaultData = this.getDefaultDataStructure(error.file);
        database.ensureFile(error.file, defaultData);
      });

      // Notification avec plus de détails
      this.notifyDataChange('SYNC_COMPLETE', {
        integrityReport,
        syncedAt: new Date().toISOString(),
        repairedFiles: integrityReport.errors.length,
        status: integrityReport.errors.length === 0 ? 'success' : 'partial'
      });

      console.log('✅ Synchronisation des données terminée');
      return integrityReport;
    } catch (error) {
      console.error('💥 Erreur lors de la synchronisation des données:', error);
      throw error;
    }
  }

  // Nouvelle méthode pour obtenir les structures par défaut
  getDefaultDataStructure(filename) {
    const defaultStructures = {
      'flash-sales.json': [],
      'products.json': [],
      'banniereflashsale.json': [],
      'users.json': [],
      'orders.json': [],
      'admin-chat.json': { conversations: {} },
      'client-chat.json': { conversations: {} }
    };

    return defaultStructures[filename] || [];
  }

  // Obtenir les statistiques des données
  getDataStats() {
    try {
      const stats = {
        timestamp: new Date().toISOString(),
        files: {},
        summary: {
          totalSize: 0,
          totalRecords: 0,
          healthScore: 0
        }
      };

      let healthyFiles = 0;

      this.dataFiles.forEach(filename => {
        try {
          const data = database.read(filename);
          const fileSize = JSON.stringify(data).length;
          const recordCount = Array.isArray(data) ? data.length : typeof data === 'object' ? Object.keys(data).length : 1;
          
          stats.files[filename] = {
            size: recordCount,
            type: Array.isArray(data) ? 'array' : typeof data,
            lastAccess: new Date().toISOString(),
            fileSize,
            recordCount,
            status: 'healthy'
          };

          stats.summary.totalSize += fileSize;
          stats.summary.totalRecords += recordCount;
          healthyFiles++;
        } catch (error) {
          stats.files[filename] = {
            error: error.message,
            accessible: false,
            status: 'error'
          };
        }
      });

      stats.summary.healthScore = Math.round((healthyFiles / this.dataFiles.length) * 100);

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
      const cleanupReport = {
        expiredFlashSales: 0,
        oldChatMessages: 0,
        emptyRecords: 0
      };

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
          cleanupReport.expiredFlashSales = flashSales.length - activeFlashSales.length;
          cleanupCount += cleanupReport.expiredFlashSales;
          console.log(`🗑️ ${cleanupReport.expiredFlashSales} ventes flash expirées supprimées`);
        }
      }

      // Nettoyer les anciens messages de chat (plus de 30 jours)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      ['admin-chat.json', 'client-chat.json'].forEach(chatFile => {
        try {
          const chatData = database.read(chatFile);
          if (chatData && chatData.conversations) {
            Object.keys(chatData.conversations).forEach(convId => {
              const conversation = chatData.conversations[convId];
              if (conversation.messages) {
                const recentMessages = conversation.messages.filter(msg => 
                  new Date(msg.timestamp) > thirtyDaysAgo
                );
                if (recentMessages.length !== conversation.messages.length) {
                  chatData.conversations[convId].messages = recentMessages;
                  cleanupReport.oldChatMessages += conversation.messages.length - recentMessages.length;
                }
              }
            });
            database.write(chatFile, chatData);
          }
        } catch (error) {
          console.error(`Erreur lors du nettoyage de ${chatFile}:`, error);
        }
      });

      cleanupCount += cleanupReport.oldChatMessages;

      this.notifyDataChange('CLEANUP_COMPLETE', {
        itemsRemoved: cleanupCount,
        cleanupDate: new Date().toISOString(),
        details: cleanupReport
      });

      console.log(`✅ Nettoyage terminé: ${cleanupCount} éléments supprimés`);
      return { itemsRemoved: cleanupCount, details: cleanupReport };
    } catch (error) {
      console.error('💥 Erreur lors du nettoyage des données:', error);
      throw error;
    }
  }
}

module.exports = new DataSyncService();
