
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:8080', 
      'http://localhost:5173',
      'http://localhost:3000',
      'https://riziky-boutic.vercel.app',
      'https://riziky-boutic.onrender.com',
      'https://riziky-boutic-server.onrender.com',
      // Ajout des domaines Lovable
      'https://d18de9e1-f502-4cb4-bec0-327000f66a2d.lovableproject.com',
      'https://id-preview--d18de9e1-f502-4cb4-bec0-327000f66a2d.lovable.app'
    ];
    
    // Autorise toutes les origines qui contiennent lovable.app ou lovableproject.com
    if (!origin || 
        allowedOrigins.indexOf(origin) !== -1 || 
        origin.includes('lovable.app') || 
        origin.includes('lovableproject.com')) {
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
