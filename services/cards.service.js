const database = require('../core/database');
const crypto = require('crypto');

class CardsService {
  constructor() {
    this.cardsFile = 'cartes-bancaires.json';
    this.secretKey = process.env.CARD_ENCRYPTION_KEY || 'your-secret-key-32-characters-long!!';
  }

  // Chiffrer les données de carte avec des méthodes modernes
  encryptCardData(cardData) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.secretKey, 'salt', 32);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update(JSON.stringify(cardData), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('❌ Erreur de chiffrement:', error);
      throw new Error('Erreur lors du chiffrement des données de carte');
    }
  }

  // Déchiffrer les données de carte avec les méthodes modernes
  decryptCardData(encryptedData) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.secretKey, 'salt', 32);
      
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        console.error('❌ Format de données chiffrées invalide');
        return null;
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('❌ Erreur de déchiffrement:', error);
      return null;
    }
  }

  // Déterminer le type de carte
  getCardType(cardNumber) {
    const number = cardNumber.replace(/\s/g, '');
    if (number.startsWith('4')) return 'visa';
    if (number.startsWith('5') || number.startsWith('2')) return 'mastercard';
    if (number.startsWith('3')) return 'american-express';
    return 'other';
  }

  // Masquer le numéro de carte
  maskCardNumber(cardNumber) {
    const number = cardNumber.replace(/\s/g, '');
    return `************${number.slice(-4)}`;
  }

  // Obtenir toutes les cartes d'un utilisateur
  getUserCards(userId) {
    console.log('🔍 Récupération des cartes pour l\'utilisateur:', userId);
    
    try {
      const cards = database.read(this.cardsFile);
      console.log('📋 Total cartes dans la base:', cards.length);
      
      const userCards = cards
        .filter(card => card.userId === userId)
        .map(card => {
          const decryptedData = this.decryptCardData(card.encryptedData);
          if (!decryptedData) {
            console.error('❌ Impossible de déchiffrer la carte:', card.id);
            return null;
          }
          
          return {
            id: card.id,
            maskedNumber: this.maskCardNumber(decryptedData.cardNumber),
            cardType: card.cardType,
            cardName: decryptedData.cardName,
            expiryDate: decryptedData.expiryDate,
            isDefault: card.isDefault,
            createdAt: card.createdAt
          };
        })
        .filter(Boolean);
      
      console.log('✅ Cartes trouvées pour l\'utilisateur:', userCards.length);
      return userCards;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des cartes:', error);
      return [];
    }
  }

  // Ajouter une nouvelle carte
  addCard(userId, cardData, setAsDefault = false) {
    console.log('➕ Ajout d\'une nouvelle carte pour l\'utilisateur:', userId);
    console.log('📋 Données reçues:', { 
      cardName: cardData.cardName, 
      cardNumber: cardData.cardNumber ? '****' + cardData.cardNumber.slice(-4) : 'N/A',
      expiryDate: cardData.expiryDate,
      cvv: cardData.cvv ? '***' : 'N/A'
    });
    
    try {
      // Validation des données
      if (!cardData.cardNumber || !cardData.cardName || !cardData.expiryDate || !cardData.cvv) {
        throw new Error('Données de carte incomplètes');
      }

      const cards = database.read(this.cardsFile);
      
      // Si c'est la première carte ou setAsDefault est true, la marquer comme défaut
      const userCards = cards.filter(card => card.userId === userId);
      const shouldBeDefault = userCards.length === 0 || setAsDefault;
      
      console.log('🎯 Sera carte par défaut:', shouldBeDefault);
      
      // Si nouvelle carte par défaut, retirer le statut des autres
      if (shouldBeDefault) {
        cards.forEach(card => {
          if (card.userId === userId) {
            card.isDefault = false;
          }
        });
      }

      const newCard = {
        id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: userId.toString(), // S'assurer que l'userId est une string
        encryptedData: this.encryptCardData(cardData),
        cardType: this.getCardType(cardData.cardNumber),
        isDefault: shouldBeDefault,
        createdAt: new Date().toISOString()
      };

      cards.push(newCard);
      const writeSuccess = database.write(this.cardsFile, cards);
      
      if (!writeSuccess) {
        throw new Error('Erreur lors de l\'écriture dans la base de données');
      }
      
      console.log('✅ Carte ajoutée avec succès:', newCard.id);
      return newCard.id;
    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout de la carte:', error);
      throw error; // Relancer l'erreur pour la gestion dans la route
    }
  }

  // Obtenir une carte spécifique avec données déchiffrées
  getCardById(cardId, userId) {
    try {
      const cards = database.read(this.cardsFile);
      const card = cards.find(c => c.id === cardId && c.userId === userId);
      
      if (!card) {
        console.log('❌ Carte non trouvée:', cardId);
        return null;
      }
      
      const decryptedData = this.decryptCardData(card.encryptedData);
      if (!decryptedData) {
        console.error('❌ Impossible de déchiffrer la carte:', cardId);
        return null;
      }
      
      return {
        id: card.id,
        ...decryptedData,
        cardType: card.cardType,
        isDefault: card.isDefault
      };
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de la carte:', error);
      return null;
    }
  }

  // Définir une carte comme défaut
  setDefaultCard(cardId, userId) {
    try {
      const cards = database.read(this.cardsFile);
      
      // Vérifier que la carte appartient à l'utilisateur
      const targetCard = cards.find(c => c.id === cardId && c.userId === userId);
      if (!targetCard) {
        return false;
      }
      
      // Retirer le statut par défaut de toutes les cartes de l'utilisateur
      cards.forEach(card => {
        if (card.userId === userId) {
          card.isDefault = card.id === cardId;
        }
      });
      
      database.write(this.cardsFile, cards);
      console.log('✅ Carte définie comme défaut:', cardId);
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la définition de la carte par défaut:', error);
      return false;
    }
  }

  // Supprimer une carte
  deleteCard(cardId, userId) {
    try {
      const cards = database.read(this.cardsFile);
      const cardIndex = cards.findIndex(c => c.id === cardId && c.userId === userId);
      
      if (cardIndex === -1) {
        return false;
      }
      
      const wasDefault = cards[cardIndex].isDefault;
      cards.splice(cardIndex, 1);
      
      // Si la carte supprimée était par défaut, définir la première carte restante comme défaut
      if (wasDefault) {
        const userCards = cards.filter(card => card.userId === userId);
        if (userCards.length > 0) {
          userCards[0].isDefault = true;
        }
      }
      
      database.write(this.cardsFile, cards);
      console.log('✅ Carte supprimée:', cardId);
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la suppression de la carte:', error);
      return false;
    }
  }
}

module.exports = new CardsService();
