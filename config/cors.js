const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:8080', 
      'http://localhost:5173',
      'http://localhost:3000',
      'https://riziky-boutic.vercel.app',
      'https://riziky-boutic.netlify.app',
      'https://riziky-boutic.onrender.com',
      'https://riziky-boutic-server.onrender.com'
    ];
    
    // Vérifie si l'origine est autorisée ou si c'est une requête sans origin (ex: Postman, curl)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`Origine rejetée: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-Request-Id']
};

module.exports = corsOptions;
