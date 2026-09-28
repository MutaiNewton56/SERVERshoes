import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'shoe-store-api' }));

app.post('/api/messages', (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: 'Message is required.' });
  // TODO: save message to PostgreSQL and send notification email.
  console.log('New message:', message);
  res.status(201).json({ message: 'Thanks! Your message was received.' });
});

app.post('/api/orders', (req, res) => {
  // TODO: validate order, save to PostgreSQL, and send confirmation emails.
  res.status(201).json({ message: 'Order endpoint is ready for the database layer.', order: req.body });
});

app.listen(port, () => console.log(`API running on http://localhost:${port}`));
