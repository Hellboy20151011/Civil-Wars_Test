import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import authRouter from './auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '../../frontend');

app.use(cors());
app.use(express.json());

// Frontend statisch ausliefern
app.use(express.static(FRONTEND_DIR));

app.use('/auth', authRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routen für HTML-Seiten
app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'pages/index.html'));
});

app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'pages/dashboard.html'));
});

app.get('/bauhof.html', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'pages/Bauhof.html'));
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
