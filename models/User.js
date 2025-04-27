
const fs = require('fs');
const path = require('path');

const usersFilePath = path.join(__dirname, '../data/users.json');

// Vérifier si le fichier users.json existe, sinon le créer
if (!fs.existsSync(path.dirname(usersFilePath))) {
  fs.mkdirSync(path.dirname(usersFilePath), { recursive: true });
}

if (!fs.existsSync(usersFilePath)) {
  fs.writeFileSync(usersFilePath, JSON.stringify([], null, 2));
}

class User {
  constructor(id, nom, prenom, email, password, genre, adresse, phone) {
    this.id = id;
    this.nom = nom;
    this.prenom = prenom;
    this.email = email;
    this.password = password;
    this.genre = genre;
    this.adresse = adresse;
    this.phone = phone;
  }

  static getAll() {
    try {
      const usersData = fs.readFileSync(usersFilePath, 'utf8');
      return JSON.parse(usersData);
    } catch (error) {
      console.error('Erreur lors de la lecture des utilisateurs:', error);
      return [];
    }
  }

  static getById(id) {
    const users = this.getAll();
    return users.find(user => user.id === parseInt(id));
  }

  static getByEmail(email) {
    const users = this.getAll();
    return users.find(user => user.email === email);
  }

  static save(userData) {
    const users = this.getAll();
    
    // Vérifier si l'email existe déjà
    if (users.some(user => user.email === userData.email)) {
      return { success: false, message: 'Cet email est déjà utilisé' };
    }
    
    // Générer un nouvel ID
    const newId = users.length > 0 ? Math.max(...users.map(user => user.id)) + 1 : 1;
    
    const newUser = {
      id: newId,
      nom: userData.nom,
      prenom: userData.prenom,
      email: userData.email,
      password: userData.password,
      genre: userData.genre,
      adresse: userData.adresse,
      phone: userData.phone
    };
    
    users.push(newUser);
    
    try {
      fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
      return { success: true, user: newUser };
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de l\'utilisateur:', error);
      return { success: false, message: 'Erreur lors de l\'enregistrement' };
    }
  }

  static update(id, userData) {
    const users = this.getAll();
    const index = users.findIndex(user => user.id === parseInt(id));
    
    if (index === -1) {
      return { success: false, message: 'Utilisateur non trouvé' };
    }
    
    // Vérifier si l'email mis à jour existe déjà chez un autre utilisateur
    if (userData.email && userData.email !== users[index].email) {
      if (users.some(user => user.email === userData.email && user.id !== parseInt(id))) {
        return { success: false, message: 'Cet email est déjà utilisé' };
      }
    }
    
    // Mettre à jour les champs modifiés
    users[index] = { ...users[index], ...userData };
    
    try {
      fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
      return { success: true, user: users[index] };
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
      return { success: false, message: 'Erreur lors de la mise à jour' };
    }
  }

  static updatePassword(email, newPassword) {
    const users = this.getAll();
    const index = users.findIndex(user => user.email === email);
    
    if (index === -1) {
      return { success: false, message: 'Utilisateur non trouvé' };
    }
    
    // Vérifier si le nouveau mot de passe est différent de l'ancien
    if (users[index].password === newPassword) {
      return { success: false, message: 'Le nouveau mot de passe doit être différent de l\'ancien' };
    }
    
    users[index].password = newPassword;
    
    try {
      fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la mise à jour du mot de passe:', error);
      return { success: false, message: 'Erreur lors de la mise à jour du mot de passe' };
    }
  }

  static delete(id) {
    const users = this.getAll();
    const filteredUsers = users.filter(user => user.id !== parseInt(id));
    
    if (filteredUsers.length === users.length) {
      return { success: false, message: 'Utilisateur non trouvé' };
    }
    
    try {
      fs.writeFileSync(usersFilePath, JSON.stringify(filteredUsers, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'utilisateur:', error);
      return { success: false, message: 'Erreur lors de la suppression' };
    }
  }
}

module.exports = User;
