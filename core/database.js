
const fs = require('fs');
const path = require('path');

class Database {
  constructor(dataDir = path.join(__dirname, '../data')) {
    this.dataDir = dataDir;
  }

  read(filename) {
    try {
      const filePath = path.join(this.dataDir, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
        return [];
      }
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.error(`Erreur lors de la lecture de ${filename}:`, error);
      return [];
    }
  }

  write(filename, data) {
    try {
      const filePath = path.join(this.dataDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Erreur lors de l'écriture de ${filename}:`, error);
      return false;
    }
  }

  exists(filename) {
    const filePath = path.join(this.dataDir, filename);
    return fs.existsSync(filePath);
  }

  ensureFile(filename, defaultData = []) {
    if (!this.exists(filename)) {
      this.write(filename, defaultData);
    }
  }
}

module.exports = new Database();
