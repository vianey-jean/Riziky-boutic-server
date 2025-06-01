
/**
 * Gestionnaire de base de données basé sur le système de fichiers
 * 
 * Fournit une abstraction pour la lecture/écriture de fichiers JSON
 * utilisés comme base de données simple pour le prototype
 */

const fs = require('fs');
const path = require('path');

class Database {
  /**
   * Constructeur de la classe Database
   * @param {string} dataDir - Répertoire de stockage des données (par défaut: ../data)
   */
  constructor(dataDir = path.join(__dirname, '../data')) {
    this.dataDir = dataDir;
  }

  /**
   * Lire un fichier JSON et retourner son contenu parsé
   * @param {string} filename - Nom du fichier à lire
   * @returns {Array|Object} - Données parsées ou tableau vide si erreur
   */
  read(filename) {
    try {
      const filePath = path.join(this.dataDir, filename);
      
      // Si le fichier n'existe pas, le créer avec un tableau vide
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
        return [];
      }
      
      // Lire et parser le contenu JSON du fichier
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.error(`Erreur lors de la lecture de ${filename}:`, error);
      return []; // Retourner tableau vide en cas d'erreur
    }
  }

  /**
   * Écrire des données dans un fichier JSON
   * @param {string} filename - Nom du fichier de destination
   * @param {any} data - Données à écrire (seront stringifiées en JSON)
   * @returns {boolean} - true si succès, false si erreur
   */
  write(filename, data) {
    try {
      const filePath = path.join(this.dataDir, filename);
      // Écrire les données avec indentation pour lisibilité
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Erreur lors de l'écriture de ${filename}:`, error);
      return false;
    }
  }

  /**
   * Vérifier si un fichier existe
   * @param {string} filename - Nom du fichier à vérifier
   * @returns {boolean} - true si le fichier existe
   */
  exists(filename) {
    const filePath = path.join(this.dataDir, filename);
    return fs.existsSync(filePath);
  }

  /**
   * S'assurer qu'un fichier existe, le créer avec des données par défaut sinon
   * @param {string} filename - Nom du fichier
   * @param {any} defaultData - Données par défaut (tableau vide par défaut)
   */
  ensureFile(filename, defaultData = []) {
    if (!this.exists(filename)) {
      this.write(filename, defaultData);
    }
  }
}

// Exporter une instance unique (pattern Singleton)
module.exports = new Database();
