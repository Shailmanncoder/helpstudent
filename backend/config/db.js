const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'studyhub';

console.log('==========================================');
console.log('[DB CONFIG] Connecting MySQL with:');
console.log('  Host:    ', DB_HOST);
console.log('  Port:    ', DB_PORT);
console.log('  User:    ', DB_USER);
console.log('  Database:', DB_NAME);
console.log('==========================================');

const pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
});

async function init() {
    try {
        const conn = await mysql.createConnection({
            host: DB_HOST,
            port: DB_PORT,
            user: DB_USER,
            password: DB_PASSWORD
        });
        await conn.query(
            `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` ` +
            `DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`
        );
        await conn.end();
    } catch (err) {
        console.warn(`[DB] Could not auto-create database "${DB_NAME}":`, err.message);
        console.warn('[DB] Make sure the database exists in phpMyAdmin.');
    }

    await pool.query(`CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        xp INT DEFAULT 0,
        level INT DEFAULT 1,
        time_spent INT DEFAULT 0,
        profile_picture TEXT DEFAULT NULL,
        bio TEXT,
        plan VARCHAR(20) DEFAULT 'free',
        plan_expires_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    await pool.query(`CREATE TABLE IF NOT EXISTS notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    await pool.query(`CREATE TABLE IF NOT EXISTS activity (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        tool_used VARCHAR(100) NOT NULL,
        time_spent INT DEFAULT 0,
        xp_earned INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    await pool.query(`CREATE TABLE IF NOT EXISTS subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        plan VARCHAR(20) NOT NULL DEFAULT 'free',
        payment_id VARCHAR(255),
        order_id VARCHAR(255),
        amount INT DEFAULT 0,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    await pool.query(`CREATE TABLE IF NOT EXISTS user_unlocked_tools (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        tool_id VARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_tool (user_id, tool_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    // ── Auto-migrate: add any missing columns to existing tables ──
    const ensureColumn = async (table, column, definition) => {
        try {
            await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
            console.log(`[DB] Added missing column ${table}.${column}`);
        } catch (err) {
            if (err.code !== 'ER_DUP_FIELDNAME') {
                console.warn(`[DB] Could not add column ${table}.${column}:`, err.message);
            }
        }
    };

    const requiredUserColumns = [
        ['xp',              'INT DEFAULT 0'],
        ['level',           'INT DEFAULT 1'],
        ['time_spent',      'INT DEFAULT 0'],
        ['profile_picture', 'TEXT DEFAULT NULL'],
        ['bio',             'TEXT'],
        ['plan',            "VARCHAR(20) DEFAULT 'free'"],
        ['plan_expires_at', 'DATETIME DEFAULT NULL'],
        ['created_at',      'DATETIME DEFAULT CURRENT_TIMESTAMP']
    ];
    for (const [col, def] of requiredUserColumns) {
        await ensureColumn('users', col, def);
    }

    // ── Verify all required columns actually exist; fail loud if not ──
    const [presentCols] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
        [DB_NAME]
    );
    const present = new Set(presentCols.map(r => r.COLUMN_NAME));
    const missing = requiredUserColumns
        .map(([c]) => c)
        .filter(c => !present.has(c));
    if (missing.length > 0) {
        const msg = `[DB] FATAL: users table is missing required columns: ${missing.join(', ')}. ` +
                    `Auto-migration could not add them (check MySQL permissions or table locks).`;
        console.error(msg);
        throw new Error(msg);
    }

    console.log(`[DB] Connected to MySQL ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
}

const readyPromise = init().catch(err => {
    console.error('[DB] Initialization failed:', err.message);
    throw err;
});

const dbPromise = {
    get: async (sql, params = []) => {
        await readyPromise;
        const [rows] = await pool.execute(sql, params);
        return rows[0];
    },
    all: async (sql, params = []) => {
        await readyPromise;
        const [rows] = await pool.execute(sql, params);
        return rows;
    },
    run: async (sql, params = []) => {
        await readyPromise;
        const [result] = await pool.execute(sql, params);
        return {
            lastID: result.insertId,
            changes: result.affectedRows
        };
    },
    ready: () => readyPromise
};

module.exports = dbPromise;
