const API_BASE_URL = '/api';

const api = {
    register: async (username, password) => {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.msg || 'Registration failed'); }
        return res.json();
    },

    login: async (username, password) => {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.msg || 'Login failed'); }
        return res.json();
    },

    getProfile: async (token) => {
        const res = await fetch(`${API_BASE_URL}/user/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
    },

    updateProfile: async (token, username, profile_picture, bio) => {
        const res = await fetch(`${API_BASE_URL}/user/profile`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, profile_picture, bio })
        });
        if (!res.ok) throw new Error('Failed to update profile');
        return res.json();
    },

    deleteAccount: async (token) => {
        const res = await fetch(`${API_BASE_URL}/user/account`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete account');
        return res.json();
    },

    addXp: async (token, xp, time, tool) => {
        const res = await fetch(`${API_BASE_URL}/user/xp`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ xp, time, tool })
        });
        if (!res.ok) throw new Error('Failed to add XP');
        return res.json();
    },

    getNotes: async (token) => {
        const res = await fetch(`${API_BASE_URL}/user/notes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch notes');
        return res.json();
    },

    saveNote: async (token, title, content) => {
        const res = await fetch(`${API_BASE_URL}/user/notes`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        if (!res.ok) throw new Error('Failed to save note');
        return res.json();
    },

    getLeaderboard: async (token) => {
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE_URL}/user/leaderboard`, { headers });
        if (!res.ok) throw new Error('Failed to fetch leaderboard');
        return res.json();
    },

    generateAI: async (token, prompt, systemMessage, model) => {
        const res = await fetch(`${API_BASE_URL}/ai/generate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, systemMessage, model })
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.msg || 'AI generation failed'); }
        return res.json();
    },

    generateAIChat: async (token, messages, systemMessage, model) => {
        const res = await fetch(`${API_BASE_URL}/ai/generate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, systemMessage, model })
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.msg || 'AI generation failed'); }
        return res.json();
    },

    // Payment
    getPaymentConfig: async () => {
        const res = await fetch(`${API_BASE_URL}/payment/config`);
        if (!res.ok) throw new Error('Failed to get payment config');
        return res.json();
    },

    createPaymentOrder: async (token, plan) => {
        const res = await fetch(`${API_BASE_URL}/payment/order`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan })
        });
        if (!res.ok) {
            const e = await res.json();
            const err = new Error(e.msg || 'Failed to create order');
            err.already_active = !!e.already_active;
            err.expires_at = e.expires_at;
            throw err;
        }
        return res.json();
    },

    verifyPayment: async (token, data) => {
        const res = await fetch(`${API_BASE_URL}/payment/verify`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.msg || 'Payment verification failed'); }
        return res.json();
    },

    selectTools: async (token, tool_ids) => {
        const res = await fetch(`${API_BASE_URL}/payment/tools`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool_ids })
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.msg || 'Failed to save tools'); }
        return res.json();
    },

    getPlan: async (token) => {
        const res = await fetch(`${API_BASE_URL}/payment/plan`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to get plan');
        return res.json();
    }
};
