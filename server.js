// Earthy AI – Express backend (chat always works, email optional)

const express = require('express');
const cors = require('cors');

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------------------
   Health check
---------------------------- */
app.get('/', (req, res) => {
  res.status(200).send('Earthy AI backend running');
});

/* ---------------------------
   Environment variables
---------------------------- */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-nano';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const LEAD_TO_EMAIL = process.env.LEAD_TO_EMAIL;

if (!OPENAI_API_KEY) console.warn('OPENAI_API_KEY not set');

/* ---------------------------
   Resend (RUNTIME ONLY)
---------------------------- */
let resend = null;
if (RESEND_API_KEY) {
  const { Resend } = require('resend');
  resend = new Resend(RESEND_API_KEY);
}

/* ---------------------------
   Helper
---------------------------- */
function buildMessagesFromHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history.map(m => ({
    role: m.author === 'user' ? 'user' : 'assistant',
    content: m.text
  }));
}

/* ---------------------------
   Chat endpoint
---------------------------- */
app.post('/chat', async (req, res) => {
  try {
    const { input, history = [] } = req.body;
    if (!input) return res.status(400).json({ reply: 'Invalid input', history });

    const messages = buildMessagesFromHistory(history);

    messages.unshift({
      role: 'system',
      content:
        'You are Earthy AI, a calm and helpful assistant for service businesses. 2–4 sentences. No emojis.'
    });

    messages.push({ role: 'user', content: input });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        max_tokens: 150,
        temperature: 0.6
      })
    });

    const data = await response.json();
    const reply =
      data?.choices?.[0]?.message?.content || 'Can you clarify?';

    res.json({
      reply,
      history: [...history, { author: 'ai', text: reply }]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: 'Server error', history: [] });
  }
});

/* ---------------------------
   Lead capture (OPTIONAL)
---------------------------- */
app.post('/api/lead', async (req, res) => {
  if (!resend || !LEAD_TO_EMAIL)
    return res.status(503).json({ success: false });

  try {
