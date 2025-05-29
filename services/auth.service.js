
const bcrypt = require('bcrypt');
const database = require('../core/database');

class AuthService {
  constructor() {
    this.usersFile = 'users.json';
    this.resetCodesFile = 'reset-codes.json';
  }

  async findUserByEmail(email) {
    const users = database.read(this.usersFile);
    return users.find(user => user.email === email);
  }

  async findUserById(id) {
    const users = database.read(this.usersFile);
    return users.find(user => user.id === id);
  }

  async createUser(userData) {
    const users = database.read(this.usersFile);
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const newUser = {
      id: Date.now().toString(),
      ...userData,
      password: hashedPassword,
      role: userData.role || 'client',
      dateCreation: new Date().toISOString()
    };

    users.push(newUser);
    database.write(this.usersFile, users);
    
    return { ...newUser, password: undefined };
  }

  async updateUser(id, updateData) {
    const users = database.read(this.usersFile);
    const userIndex = users.findIndex(user => user.id === id);
    
    if (userIndex === -1) return null;

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    users[userIndex] = { ...users[userIndex], ...updateData };
    database.write(this.usersFile, users);
    
    return { ...users[userIndex], password: undefined };
  }

  async validatePassword(user, password) {
    return await bcrypt.compare(password, user.password);
  }

  saveResetCode(email, code) {
    const resetCodes = database.read(this.resetCodesFile);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const existingIndex = resetCodes.findIndex(rc => rc.email === email);
    const resetCode = { email, code, expiresAt: expiresAt.toISOString() };

    if (existingIndex >= 0) {
      resetCodes[existingIndex] = resetCode;
    } else {
      resetCodes.push(resetCode);
    }

    database.write(this.resetCodesFile, resetCodes);
  }

  validateResetCode(email, code) {
    const resetCodes = database.read(this.resetCodesFile);
    const resetCode = resetCodes.find(rc => rc.email === email && rc.code === code);
    
    if (!resetCode) return false;
    
    const now = new Date();
    const expiresAt = new Date(resetCode.expiresAt);
    
    return now < expiresAt;
  }

  removeResetCode(email) {
    const resetCodes = database.read(this.resetCodesFile);
    const filteredCodes = resetCodes.filter(rc => rc.email !== email);
    database.write(this.resetCodesFile, filteredCodes);
  }
}

module.exports = new AuthService();
