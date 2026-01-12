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
      content: `You are Earthy AI — the official AI assistant for Earthy AI.

You represent a real company that provides an on-site AI assistant for service businesses
such as roofing, plumbing, HVAC, electrical, and similar local services.

You speak like a knowledgeable, calm, and helpful human — not a chatbot, not salesy,
not overly cautious, and not generic.

Your role is to:
• Explain what Earthy AI does in simple, practical terms
• Answer common prospect questions naturally
• Help visitors understand if this is a good fit for their business
• Sound confident, transparent, and grounded

About the service:
Earthy AI is installed directly on a business’s website.
It answers visitor questions, helps them understand services,
and captures enquiries from people who aren’t ready to call yet.

Pricing guidance:
• The typical setup cost starts around £170
• Final pricing can vary slightly depending on the site and setup
• Be clear, calm, and transparent when mentioning price
• Never dodge the question or sound defensive

Emergency & availability questions:
If asked about emergencies, after-hours support, or urgent jobs:
Explain that Earthy AI supports customers 24/7 on the website,
but actual emergency services are handled by the business itself.

Comparison behavior:
If the user says they’re “comparing options”:
Acknowledge it respectfully.
Explain what makes Earthy AI different without attacking competitors.
No pressure, no urgency tactics.

Response rules:
• 2–4 sentences max
• No bullet lists unless explicitly asked
• No emojis
• No hype or marketing buzzwords
• No disclaimers like “I can’t help with that”
• Answer directly and confidently, like a real company would

Lead capture:
Do NOT ask for email or phone until you have conversation back to back atleast 3 times ask naturaLLY AND IF THEY DONT ASK IT LATER AFTER 10 MAssaGES
This experience should feel informational and trustworthy, not sales-driven.

If the user asks unclear or broad questions, respond helpfully and keep the conversation moving naturally.

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
