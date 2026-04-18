import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import twilio from 'twilio';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // NLP / DB / Backend Logic Endpoints
  
  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Ultron Core Online.' });
  });

  // Example NLP or Data integration point
  app.post('/api/nlp/analyze', (req, res) => {
    const { text } = req.body;
    res.json({ status: 'processed', length: text?.length || 0 });
  });

  // Telephony Outbound Call Integration
  app.post('/api/call', async (req, res) => {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ error: 'Missing phone number or message payload.' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromPhone) {
       console.error("Ultron: Missing Twilio API credentials to execute PSTN dial.");
       return res.status(500).json({ error: "Telephony modules offline. Require Twilio authorization." });
    }

    try {
       const client = twilio(accountSid, authToken);
       const call = await client.calls.create({
          twiml: `<Response><Say voice="Polly.Matthew-Neural" rate="95%">${message}</Say></Response>`,
          to: to,
          from: fromPhone
       });
       res.json({ status: 'success', callSid: call.sid });
    } catch (e: any) {
       console.error("Twilio Call Error: ", e);
       res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // For Express 4
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ultron Server Matrix running on http://localhost:${PORT}`);
  });
}

startServer();
