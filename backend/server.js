import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import resourcesRouter from './routes/resources.js';
import buildingsRouter from './routes/buildings.js';
import meRouter from './routes/me.js';
import unitsRouter from './routes/units.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startGameLoop } from './services/gameloop-scheduler.js';

dotenv.config();
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port;
const FRONTEND_DIR = path.join(__dirname, '../frontend');

app.use(cors({ origin: config.cors.origin }));
app.use(express.json());

// Frontend statisch ausliefern
app.use(express.static(FRONTEND_DIR));

app.use('/auth', authRouter);
app.use('/resources', resourcesRouter);
app.use('/buildings', buildingsRouter);
app.use('/units', unitsRouter);
app.use('/me', meRouter);

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

app.get('/militaer.html', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/militaer.html'));
});

// Zentraler Error-Handler (muss nach allen Routen stehen)
app.use(errorHandler);

// Game Loop starten
startGameLoop();

app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
});
