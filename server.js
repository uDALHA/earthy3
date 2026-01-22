// server.js
// Earthy AI – Express backend with OpenAI chat only

const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

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

if (!OPENAI_API_KEY) console.warn('OPENAI_API_KEY is not set');

/* ---------------------------
   Helper: build messages
---------------------------- */
function buildMessagesFromHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(m => m && m.text && m.author)
    .map(m => ({
      role: m.author === 'user' ? 'user' : 'assistant',
      content: m.text
    }));
}

/* ---------------------------
   Chat endpoint
---------------------------- */
app.post('/chat', async (req, res) => {
  try {
    const { input, history = [] } = req.body || {};
    if (!input || !input.trim()) return res.status(400).json({ reply: 'Invalid request', history });

    const messages = buildMessagesFromHistory(history);
    messages.unshift({
      role: 'system',
      content: `You are Earthy AI — official AI assistant. Answer clearly and confidently in 2-4 sentences.`
    });
    messages.push({ role: 'user', content: input });

    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
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

    const data = await openaiResp.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || 'Could you clarify that?';

    res.json({ reply, history: [...history, { author: 'ai', text: reply }] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: 'Server error', history: req.body?.history || [] });
  }
});

/* ---------------------------
   Server start
---------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Earthy AI server running on port ${PORT}`));
