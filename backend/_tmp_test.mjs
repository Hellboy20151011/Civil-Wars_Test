import pool from "./database/db.js";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import * as espionageService from "./services/espionage.service.js";

// Get user 4 (Daniel) info
const userRes = await pool.query("SELECT id, username, role FROM users WHERE id = 4");
const user = userRes.rows[0];
console.log("User:", user);

// Test getMissionPreview directly
try {
    const result = await espionageService.getMissionPreview(user.id, 2, [{ user_unit_id: 2, quantity: 1 }]);
    console.log("Preview result:", JSON.stringify(result, null, 2));
} catch (err) {
    console.log("Preview error:", err.status, err.code, err.message);
}

await pool.end();
