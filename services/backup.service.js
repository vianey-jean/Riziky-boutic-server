const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

class BackupService {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.backupDir = path.join(__dirname, '../backups');
    this.transporter = null;
    this.cronJob = null;
    
    // Créer le dossier de sauvegarde s'il n'existe pas
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    // Initialiser avec les paramètres SMTP existants
    this.initializeSMTP();
  }

  // Initialiser SMTP avec les paramètres existants
  async initializeSMTP() {
    try {
      const smtpSettingsPath = path.join(this.dataDir, 'smtp-settings.json');
      if (fs.existsSync(smtpSettingsPath)) {
        const smtpSettings = JSON.parse(fs.readFileSync(smtpSettingsPath, 'utf8'));
        if (smtpSettings.host && smtpSettings.username) {
          this.configureSMTP(smtpSettings);
        }
      }
    } catch (error) {
      console.log('Aucune configuration SMTP trouvée, configuration requise');
    }
  }

  // Configurer le transporteur SMTP
  configureSMTP(smtpSettings) {
    try {
      this.transporter = nodemailer.createTransporter({
        host: smtpSettings.host,
        port: smtpSettings.port,
        secure: smtpSettings.port === 465,
        auth: {
          user: smtpSettings.username,
          pass: smtpSettings.password
        }
      });
      console.log('SMTP configuré avec succès');
    } catch (error) {
      console.error('Erreur configuration SMTP:', error);
    }
  }

  // Créer une sauvegarde complète
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupId = uuidv4();
      const backupFileName = `backup-${timestamp}-${backupId}.json`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // Lire tous les fichiers de données
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
        'notification-settings.json'
      ];

      const backupData = {
        timestamp: new Date().toISOString(),
        backupId,
        version: '2.1.0',
        data: {}
      };

      // Collecter toutes les données
      for (const file of dataFiles) {
        const filePath = path.join(this.dataDir, file);
        if (fs.existsSync(filePath)) {
          try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            backupData.data[file] = JSON.parse(fileContent);
          } catch (error) {
            console.error(`Erreur lors de la lecture de ${file}:`, error);
            backupData.data[file] = [];
          }
        } else {
          backupData.data[file] = [];
        }
      }

      // Sauvegarder les métadonnées
      backupData.metadata = {
        totalFiles: dataFiles.length,
        totalSize: JSON.stringify(backupData).length,
        createdAt: new Date().toISOString()
      };

      // Écrire le fichier de sauvegarde
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

      // Enregistrer l'info de sauvegarde dans la base
      await this.saveBackupInfo(backupData);

      console.log(`Sauvegarde créée: ${backupFileName}`);
      return { success: true, backupPath, backupData };
    } catch (error) {
      console.error('Erreur lors de la création de la sauvegarde:', error);
      throw error;
    }
  }

  // Sauvegarder les informations de sauvegarde
  async saveBackupInfo(backupData) {
    try {
      const backupsInfoPath = path.join(this.dataDir, 'backups-info.json');
      let backupsInfo = [];

      if (fs.existsSync(backupsInfoPath)) {
        const content = fs.readFileSync(backupsInfoPath, 'utf8');
        backupsInfo = JSON.parse(content);
      }

      backupsInfo.push({
        id: backupData.backupId,
        timestamp: backupData.timestamp,
        metadata: backupData.metadata,
        status: 'completed'
      });

      // Garder seulement les 50 dernières sauvegardes
      if (backupsInfo.length > 50) {
        backupsInfo = backupsInfo.slice(-50);
      }

      fs.writeFileSync(backupsInfoPath, JSON.stringify(backupsInfo, null, 2));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des informations:', error);
    }
  }

  // Envoyer la sauvegarde par email
  async sendBackupByEmail(backupData, adminEmail) {
    try {
      if (!this.transporter) {
        throw new Error('SMTP non configuré');
      }

      const mailOptions = {
        from: process.env.SMTP_FROM_EMAIL || 'noreply@example.com',
        to: adminEmail,
        subject: `Sauvegarde automatique - ${new Date().toLocaleDateString('fr-FR')}`,
        html: `
          <h2>Sauvegarde automatique de la base de données</h2>
          <p>La sauvegarde automatique du ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} a été effectuée avec succès.</p>
          
          <h3>Détails de la sauvegarde:</h3>
          <ul>
            <li><strong>ID:</strong> ${backupData.backupId}</li>
            <li><strong>Timestamp:</strong> ${backupData.timestamp}</li>
            <li><strong>Nombre de fichiers:</strong> ${backupData.metadata.totalFiles}</li>
            <li><strong>Taille:</strong> ${(backupData.metadata.totalSize / 1024).toFixed(2)} KB</li>
          </ul>
          
          <p>Les données sauvegardées incluent:</p>
          <ul>
            <li>Utilisateurs</li>
            <li>Produits</li>
            <li>Commandes</li>
            <li>Panier</li>
            <li>Favoris</li>
            <li>Contacts</li>
            <li>Conversations de chat</li>
            <li>Préférences</li>
            <li>Avis</li>
            <li>Tous les paramètres de configuration</li>
          </ul>
          
          <p>Cette sauvegarde est automatiquement stockée et peut être utilisée pour restaurer le système en cas de besoin.</p>
        `,
        attachments: [
          {
            filename: `backup-${new Date().toISOString().split('T')[0]}.json`,
            content: JSON.stringify(backupData, null, 2),
            contentType: 'application/json'
          }
        ]
      };

      await this.transporter.sendMail(mailOptions);
      console.log('Sauvegarde envoyée par email à:', adminEmail);
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la sauvegarde par email:', error);
      throw error;
    }
  }

  // Configurer la sauvegarde automatique
  configureAutoBackup(backupSettings, smtpSettings) {
    try {
      // Arrêter les tâches cron existantes
      if (this.cronJob) {
        this.cronJob.stop();
        this.cronJob = null;
      }

      if (!backupSettings.enableAutoBackup) {
        console.log('Sauvegarde automatique désactivée');
        return { success: true, message: 'Sauvegarde automatique désactivée' };
      }

      // Configurer SMTP si fourni
      if (smtpSettings && smtpSettings.host) {
        this.configureSMTP(smtpSettings);
      }

      // Vérifier que SMTP est configuré
      if (!this.transporter) {
        throw new Error('Configuration SMTP requise pour la sauvegarde automatique');
      }

      // Parser l'heure (format HH:MM)
      const [hour, minute] = backupSettings.backupTime.split(':');
      
      let cronPattern;
      switch (backupSettings.backupFrequency) {
        case 'daily':
          cronPattern = `${minute} ${hour} * * *`;
          break;
        case 'weekly':
          cronPattern = `${minute} ${hour} * * 0`; // Dimanche
          break;
        case 'monthly':
          cronPattern = `${minute} ${hour} 1 * *`; // Premier jour du mois
          break;
        default:
          cronPattern = `${minute} ${hour} * * *`; // Par défaut quotidien
      }

      // Programmer la tâche cron
      this.cronJob = cron.schedule(cronPattern, async () => {
        try {
          console.log('Démarrage de la sauvegarde automatique...');
          const result = await this.createBackup();
          
          if (result.success && backupSettings.adminEmail) {
            await this.sendBackupByEmail(result.backupData, backupSettings.adminEmail);
          }
          
          console.log('Sauvegarde automatique terminée avec succès');
        } catch (error) {
          console.error('Erreur lors de la sauvegarde automatique:', error);
        }
      }, {
        scheduled: true,
        timezone: 'Europe/Paris'
      });

      console.log(`Sauvegarde automatique configurée: ${cronPattern} (${backupSettings.backupFrequency})`);
      return { success: true, message: 'Sauvegarde automatique configurée avec succès' };
      
    } catch (error) {
      console.error('Erreur lors de la configuration de la sauvegarde:', error);
      throw error;
    }
  }

  // Restaurer à partir d'une sauvegarde
  async restoreFromBackup(backupData) {
    try {
      for (const [fileName, fileData] of Object.entries(backupData.data)) {
        const filePath = path.join(this.dataDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
      }
      
      console.log('Restauration terminée avec succès');
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la restauration:', error);
      throw error;
    }
  }
}

module.exports = new BackupService();
