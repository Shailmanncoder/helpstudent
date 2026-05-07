const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'studyhub';

console.log('==========================================');
console.log('[DB CONFIG] Trying MySQL first:');
console.log('  Host:    ', DB_HOST);
console.log('  Port:    ', DB_PORT);
console.log('  User:    ', DB_USER);
console.log('  Database:', DB_NAME);
console.log('  (will fall back to SQLite if MySQL unreachable)');
console.log('==========================================');

let dialect = 'mysql';
let pool = null;
let sqliteDb = null;

// Translate MySQL-specific syntax to SQLite when running in fallback mode.
function translateForSqlite(sql) {
    let s = sql;
    s = s.replace(/INSERT IGNORE\b/gi, 'INSERT OR IGNORE');
    s = s.replace(
        /ON DUPLICATE KEY UPDATE\s+([\s\S]*?)(?=\s*$)/i,
        (_, assigns) => {
            const newAssigns = assigns
                .split(',')
                .map(a => a.replace(/VALUES\s*\(\s*([`"]?)(\w+)\1\s*\)/gi, 'excluded.$2').trim())
                .join(', ');
            return `ON CONFLICT(user_id) DO UPDATE SET ${newAssigns}`;
        }
    );
    return s;
}

function runSqlite(sql, params, mode) {
    return new Promise((resolve, reject) => {
        const translated = translateForSqlite(sql);
        if (mode === 'get') {
            sqliteDb.get(translated, params, (err, row) => err ? reject(err) : resolve(row));
        } else if (mode === 'all') {
            sqliteDb.all(translated, params, (err, rows) => err ? reject(err) : resolve(rows || []));
        } else {
            sqliteDb.run(translated, params, function (err) {
                if (err) return reject(err);
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        }
    });
}

async function initMysql() {
    const conn = await mysql.createConnection({
        host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD,
        connectTimeout: 3000
    });
    await conn.query(
        `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` ` +
        `DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`
    );
    await conn.end();

    pool = mysql.createPool({
        host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD,
        database: DB_NAME, waitForConnections: true, connectionLimit: 10,
        queueLimit: 0, dateStrings: true, connectTimeout: 3000
    });

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
        ['xp', 'INT DEFAULT 0'],
        ['level', 'INT DEFAULT 1'],
        ['time_spent', 'INT DEFAULT 0'],
        ['profile_picture', 'TEXT DEFAULT NULL'],
        ['bio', 'TEXT'],
        ['plan', "VARCHAR(20) DEFAULT 'free'"],
        ['plan_expires_at', 'DATETIME DEFAULT NULL'],
        ['created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP']
    ];
    for (const [col, def] of requiredUserColumns) {
        await ensureColumn('users', col, def);
    }

    console.log(`[DB] Connected to MySQL ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
}

async function initSqlite() {
    const dir = path.join(__dirname, '..', 'database');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const dbPath = path.join(dir, 'studyhub.db');

    await new Promise((resolve, reject) => {
        sqliteDb = new sqlite3.Database(dbPath, (err) => err ? reject(err) : resolve());
    });

    const exec = (sql) => new Promise((resolve, reject) => {
        sqliteDb.exec(sql, (err) => err ? reject(err) : resolve());
    });

    await exec(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        time_spent INTEGER DEFAULT 0,
        profile_picture TEXT DEFAULT NULL,
        bio TEXT,
        plan TEXT DEFAULT 'free',
        plan_expires_at TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    await exec(`CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    await exec(`CREATE TABLE IF NOT EXISTS activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tool_used TEXT NOT NULL,
        time_spent INTEGER DEFAULT 0,
        xp_earned INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    await exec(`CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        plan TEXT NOT NULL DEFAULT 'free',
        payment_id TEXT,
        order_id TEXT,
        amount INTEGER DEFAULT 0,
        expires_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    await exec(`CREATE TABLE IF NOT EXISTS user_unlocked_tools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tool_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, tool_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    console.log(`[DB] Connected to SQLite ${dbPath}`);
}

async function init() {
    try {
        await initMysql();
        dialect = 'mysql';
    } catch (err) {
        console.warn('[DB] MySQL unavailable:', err.message);
        console.warn('[DB] Falling back to SQLite (Replit/no-MAMP mode)');
        await initSqlite();
        dialect = 'sqlite';
    }
}

const readyPromise = init().catch(err => {
    console.error('[DB] Initialization failed:', err.message);
    throw err;
});

const db = {
    get: async (sql, params = []) => {
        await readyPromise;
        if (dialect === 'mysql') {
            const [rows] = await pool.execute(sql, params);
            return rows[0];
        }
        return runSqlite(sql, params, 'get');
    },
    all: async (sql, params = []) => {
        await readyPromise;
        if (dialect === 'mysql') {
            const [rows] = await pool.execute(sql, params);
            return rows;
        }
        return runSqlite(sql, params, 'all');
    },
    run: async (sql, params = []) => {
        await readyPromise;
        if (dialect === 'mysql') {
            const [result] = await pool.execute(sql, params);
            return { lastID: result.insertId, changes: result.affectedRows };
        }
        return runSqlite(sql, params, 'run');
    },
    ready: () => readyPromise,
    dialect: () => dialect
};

module.exports = db;
