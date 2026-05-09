const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const db = require('../config/db');

const PLANS = {
    basic:    { name: 'Basic Spark',    price: 50,  tools: 10,       duration_days: 90 },
    standard: { name: 'Standard',       price: 200, tools: 25,       duration_days: 90 },
    pro:      { name: 'Pro Unlimited',  price: 600, tools: Infinity, duration_days: 90 }
};

const DEMO_MODE = !process.env.RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_KEY_ID === 'demo' ||
    process.env.RAZORPAY_KEY_ID === 'your_razorpay_key_id';

let razorpay = null;
if (!DEMO_MODE) {
    try {
        const Razorpay = require('razorpay');
        razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
    } catch (e) {
        console.warn('Razorpay init failed, running in demo mode:', e.message);
    }
}

// GET /api/payment/config — send public key + demo flag
router.get('/config', (req, res) => {
    res.json({
        demo_mode: DEMO_MODE || !razorpay,
        key_id: DEMO_MODE ? null : process.env.RAZORPAY_KEY_ID
    });
});

// POST /api/payment/order — create Razorpay order
router.post('/order', auth, async (req, res) => {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ msg: 'Invalid plan' });

    const existing = await db.get('SELECT plan, plan_expires_at FROM users WHERE id = ?', [req.user.id]);
    if (existing && existing.plan === plan && existing.plan_expires_at) {
        const exp = new Date(existing.plan_expires_at);
        if (exp > new Date()) {
            return res.status(400).json({
                msg: `You already have an active ${PLANS[plan].name} plan until ${exp.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}.`,
                already_active: true,
                expires_at: existing.plan_expires_at
            });
        }
    }

    const amount = PLANS[plan].price * 100;

    if (DEMO_MODE || !razorpay) {
        return res.json({
            demo: true,
            order_id: 'demo_order_' + Date.now(),
            amount,
            currency: 'INR',
            plan
        });
    }

    try {
        const order = await razorpay.orders.create({
            amount,
            currency: 'INR',
            receipt: `ord_${req.user.id}_${Date.now()}`,
            notes: { user_id: String(req.user.id), plan }
        });
        res.json({ order_id: order.id, amount, currency: 'INR', plan, key_id: process.env.RAZORPAY_KEY_ID });
    } catch (err) {
        console.error('Razorpay order error:', err.message);
        res.status(500).json({ msg: 'Failed to create order', details: err.message });
    }
});

// POST /api/payment/verify — verify payment & activate subscription
router.post('/verify', auth, async (req, res) => {
    const { order_id, payment_id, signature, plan, demo } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ msg: 'Invalid plan' });

    if (!demo && !DEMO_MODE && razorpay) {
        const body = order_id + '|' + payment_id;
        const expected = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');
        if (expected !== signature) {
            return res.status(400).json({ msg: 'Invalid payment signature' });
        }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + PLANS[plan].duration_days);

    try {
        await db.run(
            `INSERT INTO subscriptions (user_id, plan, payment_id, order_id, amount, expires_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               plan = VALUES(plan),
               payment_id = VALUES(payment_id),
               order_id = VALUES(order_id),
               amount = VALUES(amount),
               expires_at = VALUES(expires_at)`,
            [req.user.id, plan, payment_id || 'demo_' + Date.now(), order_id, PLANS[plan].price * 100, expiresAt.toISOString().slice(0, 19).replace('T', ' ')]
        );
        await db.run(
            'UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?',
            [plan, expiresAt.toISOString().slice(0, 19).replace('T', ' '), req.user.id]
        );

        if (plan === 'pro') {
            await db.run('DELETE FROM user_unlocked_tools WHERE user_id = ?', [req.user.id]);
        }

        res.json({
            success: true,
            plan,
            expires_at: expiresAt.toISOString(),
            needs_tool_selection: plan !== 'pro'
        });
    } catch (err) {
        console.error('Subscription activation error:', err.message);
        res.status(500).json({ msg: 'Failed to activate subscription' });
    }
});

// POST /api/payment/tools — save selected tools
router.post('/tools', auth, async (req, res) => {
    const { tool_ids } = req.body;
    if (!Array.isArray(tool_ids)) return res.status(400).json({ msg: 'tool_ids must be an array' });

    const user = await db.get('SELECT plan, plan_expires_at FROM users WHERE id = ?', [req.user.id]);
    if (!user || user.plan === 'free') return res.status(403).json({ msg: 'No active subscription' });

    const isActive = user.plan_expires_at ? new Date(user.plan_expires_at) > new Date() : false;
    if (!isActive) return res.status(403).json({ msg: 'Subscription expired' });

    const maxTools = PLANS[user.plan]?.tools || 0;
    if (tool_ids.length > maxTools) {
        return res.status(400).json({ msg: `Your plan allows max ${maxTools} tools` });
    }

    try {
        await db.run('DELETE FROM user_unlocked_tools WHERE user_id = ?', [req.user.id]);
        for (const tool_id of tool_ids) {
            await db.run(
                'INSERT IGNORE INTO user_unlocked_tools (user_id, tool_id) VALUES (?, ?)',
                [req.user.id, tool_id]
            );
        }
        res.json({ success: true, unlocked: tool_ids });
    } catch (err) {
        res.status(500).json({ msg: 'Failed to save tools' });
    }
});

// GET /api/payment/plan — get current plan + unlocked tools
router.get('/plan', auth, async (req, res) => {
    try {
        const user = await db.get(
            'SELECT plan, plan_expires_at, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        const tools = await db.all(
            'SELECT tool_id FROM user_unlocked_tools WHERE user_id = ?',
            [req.user.id]
        );

        const plan = user?.plan || 'free';
        const expiresAt = user?.plan_expires_at;
        const isActive = plan !== 'free' && expiresAt ? new Date(expiresAt) > new Date() : false;

        let trialActive = false;
        let trialExpiresAt = null;
        if (user?.created_at) {
            const created = new Date(user.created_at);
            const trialEnd = new Date(created.getTime() + 3 * 24 * 60 * 60 * 1000);
            trialExpiresAt = trialEnd.toISOString();
            trialActive = !isActive && trialEnd > new Date();
        }

        res.json({
            plan: isActive ? plan : 'free',
            expires_at: expiresAt,
            is_active: isActive,
            trial_active: trialActive,
            trial_expires_at: trialExpiresAt,
            unlocked_tools: tools.map(t => t.tool_id),
            demo_mode: DEMO_MODE || !razorpay
        });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
