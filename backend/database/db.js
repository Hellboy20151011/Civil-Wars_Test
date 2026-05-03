import pg from 'pg';
import dotenv from 'dotenv';
import { config } from '../config.js';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    ...config.db,
    max: config.db.poolMax,
});

export default pool;
