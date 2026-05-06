const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// ── AI Provider Setup ──────────────────────────────────────────────
// Priority: 1) Replit AI Integrations (managed Gemini via OpenAI-compatible API)
//           2) Direct Google Gemini API key
//           3) Groq fallback
//           4) Simulated response

let aiMode = 'none';
let gemini = null;
let groq = null;

// 1. Replit AI Integrations (set automatically after blueprint install)
const REPLIT_BASE_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const REPLIT_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
if (REPLIT_BASE_URL && REPLIT_KEY) {
    aiMode = 'replit';
    console.log('AI: Using Replit AI Integrations (Gemini)');
}

// 2. Direct Gemini key
if (aiMode === 'none') {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== 'your_gemini_api_key_here' && key.length > 10) {
        try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            gemini = new GoogleGenerativeAI(key);
            aiMode = 'gemini';
            console.log('AI: Using direct Gemini API key');
        } catch (e) {
            console.warn('Gemini SDK error:', e.message);
        }
    }
}

// 3. Groq fallback
if (aiMode === 'none') {
    const key = process.env.GROQ_API_KEY;
    if (key && key !== 'your_groq_api_key_here') {
        try {
            const Groq = require('groq-sdk/index.js');
            groq = new Groq({ apiKey: key });
            aiMode = 'groq';
            console.log('AI: Using Groq fallback');
        } catch (e) {
            console.warn('Groq SDK error:', e.message);
        }
    }
}

if (aiMode === 'none') {
    console.warn('AI: No AI provider configured — using simulated responses');
}

// ── Helper: build message array ────────────────────────────────────
function buildMessages(prompt, systemMessage, messages) {
    if (Array.isArray(messages) && messages.length > 0) {
        // ensure system message at front
        const hasSystem = messages.some(m => m.role === 'system');
        if (!hasSystem && systemMessage) {
            return [{ role: 'system', content: systemMessage }, ...messages];
        }
        return messages;
    }
    const sys = systemMessage || 'You are a helpful AI study assistant.';
    return [
        { role: 'system', content: sys },
        { role: 'user', content: String(prompt || '') }
    ];
}

// ── Allowed Gemini models (server-side allowlist to prevent client cost abuse) ──
const ALLOWED_MODELS = new Set([
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest'
]);
const DEFAULT_MODEL = 'gemini-2.5-flash';

function pickModel(requested) {
    if (requested && ALLOWED_MODELS.has(requested)) return requested;
    const envModel = process.env.GEMINI_MODEL;
    if (envModel && ALLOWED_MODELS.has(envModel)) return envModel;
    return DEFAULT_MODEL;
}

// ── POST /api/ai/generate ──────────────────────────────────────────
router.post('/generate', auth, async (req, res) => {
    try {
        const { prompt, systemMessage = 'You are a helpful AI study assistant.', model, messages } = req.body;

        if (!prompt && !messages) {
            return res.status(400).json({ msg: 'Prompt or messages array is required' });
        }

        const safeModel = pickModel(model);
        const apiMessages = buildMessages(prompt, systemMessage, messages);

        // ── Replit AI Integrations path (OpenAI-compatible Gemini endpoint) ──
        if (aiMode === 'replit') {
            const OpenAI = require('openai');
            const client = new OpenAI({
                apiKey: REPLIT_KEY,
                baseURL: REPLIT_BASE_URL
            });
            const modelName = safeModel;
            const completion = await client.chat.completions.create({
                model: modelName,
                messages: apiMessages,
                max_tokens: 8192
            });
            return res.json({ result: completion.choices[0]?.message?.content || '' });
        }

        // ── Direct Gemini path (with model fallback) ──
        if (aiMode === 'gemini' && gemini) {
            const generationConfig = { temperature: 0.7, maxOutputTokens: 8192 };
            const primaryModel = safeModel;
            // Only models confirmed to have quota on this key; lighter models listed first as backup
            const fallbackModels = [
                primaryModel,
                'gemini-2.5-flash-lite',
                'gemini-2.5-flash',
                'gemini-flash-latest'
            ].filter((m, i, a) => a.indexOf(m) === i); // deduplicate

            // Filter out system messages for Gemini (handled via systemInstruction)
            const userMessages = apiMessages.filter(m => m.role !== 'system');

            async function tryGenerate(genModel) {
                if (userMessages.length > 1) {
                    let lastUserIdx = -1;
                    for (let i = userMessages.length - 1; i >= 0; i--) {
                        if (userMessages[i].role === 'user') { lastUserIdx = i; break; }
                    }
                    if (lastUserIdx === -1) throw new Error('No user message found');
                    const history = userMessages.slice(0, lastUserIdx).map(m => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    }));
                    const chat = genModel.startChat({ history, generationConfig });
                    const result = await chat.sendMessage(userMessages[lastUserIdx].content);
                    return result.response?.text?.() || '';
                }
                const lastMsg = userMessages[userMessages.length - 1]?.content || String(prompt);
                const result = await genModel.generateContent({
                    contents: [{ role: 'user', parts: [{ text: lastMsg }] }],
                    generationConfig
                });
                return result.response?.text?.() || '';
            }

            let lastErr;
            for (const tryModel of fallbackModels) {
                // Try each model up to 2 times for transient 503s
                for (let attempt = 0; attempt < 2; attempt++) {
                    try {
                        const genModel = gemini.getGenerativeModel({ model: tryModel, systemInstruction: systemMessage });
                        const text = await tryGenerate(genModel);
                        return res.json({ result: text });
                    } catch (err) {
                        lastErr = err;
                        const msg = err.message || '';
                        const is503 = msg.includes('503') || msg.includes('overloaded') || msg.includes('high demand') || msg.includes('Service Unavailable');
                        const isNoQuota = msg.includes('429') && msg.includes('limit: 0');
                        const isNotFound = msg.includes('404') || msg.includes('not found');

                        if (isNoQuota || isNotFound) {
                            // Skip to next model entirely
                            console.warn(`Gemini model ${tryModel} has no quota/not found, skipping...`);
                            break;
                        }
                        if (is503) {
                            if (attempt === 0) {
                                console.warn(`Gemini model ${tryModel} overloaded (attempt ${attempt + 1}), retrying in 2s...`);
                                await new Promise(r => setTimeout(r, 2000));
                            } else {
                                console.warn(`Gemini model ${tryModel} still overloaded, trying next model...`);
                            }
                            continue;
                        }
                        // Unknown error — rethrow
                        throw err;
                    }
                }
            }
            throw lastErr;
        }

        // ── Groq path ──
        if (aiMode === 'groq' && groq) {
            const groqModel = model || 'llama-3.3-70b-versatile';
            const completion = await groq.chat.completions.create({
                messages: apiMessages,
                model: groqModel,
                temperature: 0.7,
                max_tokens: 4096
            });
            return res.json({ result: completion.choices[0]?.message?.content || '' });
        }

        // ── Simulated fallback ──
        await new Promise(r => setTimeout(r, 600));
        return res.json({ result: '⚠️ No AI provider configured. Please set up the Gemini integration in your project settings.' });

    } catch (err) {
        console.error('AI Generation Error:', err.message);
        res.status(500).json({ msg: 'AI Service Error', details: err.message });
    }
});

// ── GET /api/ai/image ─────────────────────────────────────────────
router.get('/image', async (req, res) => {
    try {
        const { prompt, model, width, height, enhance } = req.query;
        if (!prompt) return res.status(400).json({ msg: 'Prompt required' });

        const clampInt = (val, def, min, max) => {
            const n = Number.parseInt(String(val ?? ''), 10);
            return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
        };

        const w = clampInt(width, 1280, 256, 2048);
        const h = clampInt(height, 720, 256, 2048);
        const seed = Math.floor(Math.random() * 1000000);
        const modelParam = model ? `&model=${encodeURIComponent(String(model))}` : '';
        const enhanceParam = String(enhance).toLowerCase() === 'true' ? '&enhance=true' : '';
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&seed=${seed}${modelParam}${enhanceParam}`;

        const imageRes = await fetch(url);
        if (!imageRes.ok) return res.status(500).json({ msg: 'Failed to generate image' });

        res.setHeader('Content-Type', 'image/jpeg');
        const buffer = await imageRes.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (err) {
        console.error('Image proxy error:', err);
        res.status(500).json({ msg: 'Server Error during image generation' });
    }
});

module.exports = router;
