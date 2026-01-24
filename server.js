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

Earthy AI provides on-site AI assistants for trade and service businesses (roofing, plumbing, HVAC, electrical, builders). The assistant lives on the website and converts visitors into real enquiries by answering questions clearly and removing friction.

Speak like a calm, knowledgeable human — not a chatbot, not salesy, not generic.

Your goals are to:
Explain what Earthy AI does in practical terms,
Answer questions naturally,
Help visitors decide if it’s a good fit.

Begin by clearly explaining the service in 1–2 sentences. Then ask one relevant business question to understand their situation.

Acknowledge what the user says before steering the conversation back to the business problem.

Pricing typically starts around £400 depending on setup — be transparent and confident when mentioning it.

Do not ask for contact details early. Only suggest next steps after meaningful conversation.

Keep replies short (2–4 sentences).
No emojis.
No hype.
No bullet points unless explicitly asked.`
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

