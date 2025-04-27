
const nodemailer = require('nodemailer');

class Contact {
  static async send(contactData) {
    try {
      // Créer un transporteur SMTP
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false, // true pour 465, false pour d'autres ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // Format du message
      const mailOptions = {
        from: `"${contactData.nom}" <${contactData.email}>`,
        to: process.env.SMTP_USER, // Destinataire (adresse de réception des messages du site)
        subject: `[Contact Riziky-Agendas] ${contactData.sujet}`,
        text: `Message de: ${contactData.nom} (${contactData.email})\n\n${contactData.message}`,
        html: `
          <h2>Nouveau message de contact</h2>
          <p><strong>De:</strong> ${contactData.nom}</p>
          <p><strong>Email:</strong> ${contactData.email}</p>
          <p><strong>Sujet:</strong> ${contactData.sujet}</p>
          <div style="margin-top: 20px; padding: 15px; border-left: 4px solid #ccc;">
            <p>${contactData.message.replace(/\n/g, '<br>')}</p>
          </div>
        `,
      };

      // Envoyer l'email
      const info = await transporter.sendMail(mailOptions);
      console.log('Message envoyé: %s', info.messageId);
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email:', error);
      return { success: false, message: 'Erreur lors de l\'envoi de l\'email' };
    }
  }
}

module.exports = Contact;
