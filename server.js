
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
// Use environment variable or fallback to 10000
const port = process.env.PORT || 10000;

// CORS configuration
// Use environment variable or fallback for origin
const corsOptions = {
  origin: process.env.CLIENT_URL || 'https://riziky-boutic.vercel.app/',
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Middleware to parse JSON bodies
app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set to true if your using https
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Read users from the JSON file
const usersFilePath = path.join(__dirname, 'data/users.json');
const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));

// Passport Local Strategy
passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
},
  (email, password, done) => {
    const user = users.find(user => user.email === email);

    if (!user) {
      return done(null, false, { message: 'Incorrect email.' });
    }

    bcrypt.compare(password, user.password)
      .then(match => {
        if (!match) {
          return done(null, false, { message: 'Incorrect password.' });
        }
        return done(null, user);
      })
      .catch(err => {
        return done(err);
      });
  }
));

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user
passport.deserializeUser((id, done) => {
  const user = users.find(user => user.id === id);
  if (user) {
    done(null, user);
  } else {
    done(null, false);
  }
});

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized' });
};

// Middleware to check admin role
const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'Forbidden' });
};

// Routes
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const panierRoutes = require('./routes/panier');
const favoritesRoutes = require('./routes/favorites');
const ordersRoutes = require('./routes/orders');
const usersRoutes = require('./routes/users');
const contactsRoutes = require('./routes/contacts');
const adminChatRoutes = require('./routes/admin-chat');
const clientChatRoutes = require('./routes/client-chat');

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Add specific route to serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/panier', panierRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/admin-chat', adminChatRoutes);
app.use('/api/client-chat', clientChatRoutes);

// Ajouter la route pour chatclient.json - Mise à jour pour toujours lire la dernière version
app.get('/api/data/chatclient', isAuthenticated, (req, res) => {
  try {
    // Toujours lire directement le fichier pour avoir les données les plus récentes
    const chatData = fs.readFileSync(path.join(__dirname, 'data/chatclient.json'), 'utf8');
    res.json(JSON.parse(chatData));
  } catch (error) {
    console.error("Erreur lors de la lecture de chatclient.json:", error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Client URL: ${process.env.CLIENT_URL || 'https://riziky-boutic.vercel.app/'}`);
});
