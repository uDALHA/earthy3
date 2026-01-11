// server.js
// Minimal Express backend for Earthy AI (corporate entity version)

const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set.');
}

// Build messages safely from frontend history
function buildMessagesFromHistory(history = []) {
  if (!Array.isArray(history)) return [];

  return history
    .filter(m => m && m.text && m.author)
    .map(m => ({
      role: m.author === 'user' ? 'user' : 'assistant',
      content: m.text
    }));
}

app.post('/chat', async (req, res) => {
  try {
    const { input, history = [] } = req.body || {};

    if (typeof input !== 'string' || !input.trim()) {
      return res.status(400).json({
        reply: 'Invalid request.',
        history
      });
    }

    // Start with prior conversation
    const messages = buildMessagesFromHistory(history);

    // Inject Earthy AI corporate persona ONCE per request
    messages.unshift({
      role: 'system',
      content: `
You are Earthy AI, a professional corporate AI representative for Earthy AI.

Earthy AI provides intelligent on-site assistants for service-based businesses
such as roofing, plumbing, HVAC, electrical, and similar trades.

You speak as a real company — calm, confident, helpful, and human.
Never sound salesy, desperate, robotic, or like a chatbot.

You can naturally answer prospect questions such as:
- emergency or after-hours availability
- service coverage areas
- typical pricing ranges (use reasonable estimates, not guarantees)
- how the service works
- how Earthy AI compares to alternatives
- what happens after installation
- whether this is suitable for their business size
- visitors who are “just browsing” or comparing options

If the user is evaluating options, reassure them without pressure.

Response rules:
- 2–4 short sentences max
- No bullet lists unless explicitly asked
- No emojis
- No hype or marketing language
- No hallucinated specifics
- If something depends on the client, say so clearly

Lead capture rule:
- Do NOT ask for contact details in the first reply
- Only ask after at least two back-and-forth turns
- Ask once, casually, and only if interest is clear

If the user goes off-topic, acknowledge briefly and guide back naturally.
`
    });

    // Add the new user message
    messages.push({ role: 'user', content: input });

    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages,
        max_tokens: 150,
        temperature: 0.6
      })
    });

    if (!openaiResp.ok) {
      const errText = await openaiResp.text();
      console.error('OpenAI error:', errText);
      return res.status(502).json({
        reply: 'AI service error.',
        history
      });
    }

    const data = await openaiResp.json();
    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      'I’m happy to help — could you clarify that a bit?';

    /**
     * IMPORTANT FIX:
     * We ONLY append the assistant reply.
     * The frontend already has the user message.
     * This prevents duplication + flicker.
     */
    const updatedHistory = [
      ...history,
      { author: 'ai', text: reply }
    ];

    res.json({
      reply,
      history: updatedHistory
    });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({
      reply: 'Something went wrong.',
      history: req.body?.history || []
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Earthy AI server running on port ${PORT}`);
});
