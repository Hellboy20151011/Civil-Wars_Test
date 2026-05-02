import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();
const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const adminPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'postgres',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

// Alle offenen Verbindungen zur DB beenden
await adminPool.query(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = 'civil_wars_test'
      AND pid != pg_backend_pid()
`);
console.log('Verbindungen beendet');

await adminPool.query('DROP DATABASE IF EXISTS civil_wars_test');
await adminPool.query('CREATE DATABASE civil_wars_test');
console.log('Datenbank civil_wars_test neu erstellt');
await adminPool.end();

// Schema einspielen
const appPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'civil_wars_test',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

const sql = readFileSync(path.join(__dirname, '../database/setup.sql'), 'utf8');
await appPool.query(sql);
console.log('Schema erfolgreich eingespielt');
await appPool.end();
