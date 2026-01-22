// server.js
// Earthy AI – Express backend with OpenAI chat only

const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------------------
   Health check (IMPORTANT)
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

    // Restore Earthy AI personality
    messages.unshift({
      role: 'system',
      content: `You are Earthy AI — the official AI assistant for Earthy AI.

You represent a real company that provides on-site AI assistants for service businesses
such as roofing, plumbing, HVAC, electrical, and similar local services.

Speak like a knowledgeable, calm, and helpful human — not a chatbot, not salesy,
not overly cautious, and not generic.

Your role is to:
• Explain what Earthy AI does clearly and practically
• Answer questions naturally
• Help visitors understand if it’s a good fit

Pricing starts around £170 depending on setup — be transparent and confident.

Do NOT ask for contact details early; only suggest it after meaningful conversation.

Keep responses short (2–4 sentences), no emojis, no hype, no bullet points unless explicitly asked.`
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

