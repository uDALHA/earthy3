// server.js 
// Minimal Express backend for Earthy AI chat frontend.
// Changes made:
// - Removed browser-only/unnecessary imports (body-parser, openai, googleapis).
// - Use built-in express.json() middleware instead of body-parser.
// - Use global fetch to call OpenAI REST API so we don't depend on the openai npm shape/version.
// - Keep /chat POST that accepts { input, history } and returns { reply, history }.
// - Added CORS so the frontend (GitHub Pages / Railway) can call this endpoint.
// - All secrets are read from process.env.OPENAI_API_KEY (no key in code).

const express = require('express');
const cors = require('cors');

const app = express();

// Allow CORS for frontend hosted anywhere. Adjust origin if you want to restrict.
app.use(cors());
app.use(express.json()); // replaced body-parser.json()

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set. The /chat endpoint will return errors when calling OpenAI.');
}

// Helper to map incoming history to OpenAI chat messages
function buildMessagesFromHistory(history = []) {
  try {
    if (!Array.isArray(history)) return [];
    return history.map(m => ({
      role: (m.author === 'user' ? 'user' : 'assistant'),
      content: m.text || ''
    })).filter(Boolean);
  } catch (e) {
    return [];
  }
}

app.post('/chat', async (req, res) => {
  try {
    const { input, history } = req.body || {};
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ reply: 'Invalid request: input missing or not a string.', history: history || [] });
    }

    // Build messages for OpenAI from provided history, then add the new user message
    const messages = buildMessagesFromHistory(history);

    // 🌟 Inject personality system message at the top
    messages.unshift({
      role: 'system',
      content: `You are Earthy AI ,by Dalha, a human-like lead generation assistant for service businesses (plumbers, electricians, tutors, etc.). 
You speak naturally, in a friendly, grounded, and approachable tone — never salesy or robotic. 
Keep responses clear, concise, and human-like: not too short, not too long. 
When appropriate, gently guide the conversation toward collecting the user's contact info (email or phone) if they show interest. 
If the user goes off-topic, acknowledge it and steer back to discussing their business needs without being pushy. 
Always offer practical, actionable advice, generate useful ideas for their business, and keep a subtle, playful, or witty touch without overdoing humor. 
Avoid hallucinating facts, and maintain a warm, relatable, and professional tone throughout.`
    });

    messages.push({ role: 'user', content: input });

    // Call OpenAI Chat Completions API via fetch.
    // Using model name "gpt-4o-mini" as in the original code.
    // This keeps the code independent of the openai npm package version.
    if (!OPENAI_API_KEY) {
      // No API key available; return a helpful error payload without crashing.
      return res.status(500).json({ reply: '⚠️ Server not configured with OpenAI API key.', history: history || [] });
    }

    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        // You can tune additional parameters here (temperature, max_tokens, etc.)
        // max_tokens: 800,
        // temperature: 0.8
      })
    });

    if (!openaiResp.ok) {
      const text = await openaiResp.text().catch(() => '');
      console.error('OpenAI API returned non-OK:', openaiResp.status, text);
      return res.status(502).json({ reply: '⚠️ AI provider error.', history: history || [] });
    }

    const openaiData = await openaiResp.json();

    // Extract assistant reply robustly
    const reply = (openaiData &&
      Array.isArray(openaiData.choices) &&
      openaiData.choices[0] &&
      openaiData.choices[0].message &&
      openaiData.choices[0].message.content) ? openaiData.choices[0].message.content : '🤖 AI did not respond.';

    // Return history that includes the new exchange (keeps original behavior)
    const returnedHistory = Array.isArray(history) ? [...history, { author: 'user', text: input }, { author: 'ai', text: reply }] : [{ author: 'user', text: input }, { author: 'ai', text: reply }];

    res.json({ reply, history: returnedHistory });
  } catch (err) {
    console.error('Error in /chat handler:', err);
    // Keep response shape consistent on errors
    res.status(500).json({ reply: '⚠️ AI call failed.', history: req.body && req.body.history ? req.body.history : [] });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
