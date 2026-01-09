// server.js
// Minimal Express backend for Earthy AI chat frontend.

const express = require('express');
const cors = require('cors');

const app = express();

// Allow CORS for frontend hosted anywhere. Adjust origin if needed
app.use(cors());
app.use(express.json()); // built-in body parser

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

    const messages = buildMessagesFromHistory(history);

    // 🌟 Inject Earthy AI system message at the top
    messages.unshift({
      role: 'system',
      content: `You are Earthy AI, by Dalha, a human-like lead generation assistant for service businesses (plumbers, electricians, tutors, etc.). 
Speak naturally, in a friendly, grounded, and approachable tone — never salesy. 
Keep responses concise: 2–4 sentences, human-like. 
Gently guide the conversation toward collecting the user's contact info (email or phone) when relevant. 
Acknowledge off-topic messages and steer back to discussing business needs. 
Offer actionable advice, practical ideas, and subtle playful touches without overdoing humor. 
Do not hallucinate facts. Maintain a warm, relatable, and professional tone throughout.Prefer short paragraphs (2–4 lines).
Avoid lists unless explicitly asked.
Default to concise, conversational answers Lead capture rule
Do NOT ask for email or phone in the first response.
Only ask after at least two back-and-forth messages AND when the user shows clear interest in improving their business.
Ask once, casually. If ignored, wait and try later with different wording`
    });

    messages.push({ role: 'user', content: input });

    if (!OPENAI_API_KEY) {
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
        max_tokens: 150,      // concise responses
        temperature: 0.7,     // friendly but controlled tone
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
    });

    if (!openaiResp.ok) {
      const text = await openaiResp.text().catch(() => '');
      console.error('OpenAI API returned non-OK:', openaiResp.status, text);
      return res.status(502).json({ reply: '⚠️ AI provider error.', history: history || [] });
    }

    const openaiData = await openaiResp.json();

    const reply = (openaiData &&
      Array.isArray(openaiData.choices) &&
      openaiData.choices[0] &&
      openaiData.choices[0].message &&
      openaiData.choices[0].message.content) ? openaiData.choices[0].message.content : '🤖 AI did not respond.';

    const returnedHistory = Array.isArray(history) ? 
      [...history, { author: 'user', text: input }, { author: 'ai', text: reply }] : 
      [{ author: 'user', text: input }, { author: 'ai', text: reply }];

    res.json({ reply, history: returnedHistory });
  } catch (err) {
    console.error('Error in /chat handler:', err);
    res.status(500).json({ reply: '⚠️ AI call failed.', history: req.body && req.body.history ? req.body.history : [] });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
