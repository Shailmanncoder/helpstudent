const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// @route   POST api/auth/register
// @desc    Register user
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('[AUTH] register request', { username });

        if (!username || !password) {
            return res.status(400).json({ msg: 'Please enter all fields' });
        }
        if (password.length < 6) {
            return res.status(400).json({ msg: 'Password must be at least 6 characters' });
        }

        const userExists = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (userExists) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const result = await db.run(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword]
        );
        console.log('[AUTH] register inserted', { id: result.lastID, changes: result.changes });

        const payload = {
            user: { id: result.lastID }
        };

        jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret_for_local_dev', { expiresIn: '5d' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: result.lastID, username } });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error during registration' });
    }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('[AUTH] login request', { username });

        if (!username || !password) {
            return res.status(400).json({ msg: 'Please enter all fields' });
        }

        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const payload = {
            user: { id: user.id }
        };

        jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret_for_local_dev', { expiresIn: '5d' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, username: user.username, xp: user.xp, level: user.level } });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error during login' });
    }
});

module.exports = router;
