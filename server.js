// server.js
// Earthy AI – Express backend with OpenAI chat + Resend lead capture

const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();

app.use(cors());
app.use(express.json());

/* ---------------------------
   Environment variables
---------------------------- */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-nano';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const LEAD_TO_EMAIL = process.env.LEAD_TO_EMAIL;

if (!OPENAI_API_KEY) console.warn('OPENAI_API_KEY is not set');
if (!RESEND_API_KEY) console.warn('RESEND_API_KEY is not set');
if (!LEAD_TO_EMAIL) console.warn('LEAD_TO_EMAIL is not set');

/* ---------------------------
   Resend setup
---------------------------- */
const resend = new Resend(RESEND_API_KEY);

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

    if (typeof input !== 'string' || !input.trim()) {
      return res.status(400).json({
        reply: 'Invalid request.',
        history
      });
    }

    const messages = buildMessagesFromHistory(history);

    messages.unshift({
      role: 'system',
      content: `You are Earthy AI — the official AI assistant for Earthy AI.

You represent a real company that provides an on-site AI assistant for service businesses
such as roofing, plumbing, HVAC, electrical, and similar local services.

You speak like a knowledgeable, calm, and helpful human — not a chatbot, not salesy,
not overly cautious, and not generic.

Your role is to explain the product clearly, answer questions naturally,
and help visitors understand if it’s a good fit.

Pricing starts around £170 depending on setup.
Be transparent and confident when mentioning it.

Do not ask for contact details early.
Only suggest contact after meaningful conversation.

2–4 sentences max.
No emojis.
No hype.
No bullet points unless asked.`
    });

    messages.push({ role: 'user', content: input });

    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
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

    const updatedHistory = [
      ...history,
      { author: 'ai', text: reply }
    ];

    res.json({ reply, history: updatedHistory });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({
      reply: 'Something went wrong.',
      history: req.body?.history || []
    });
  }
});

/* ---------------------------
   Lead capture endpoint
---------------------------- */
app.post('/api/lead', async (req, res) => {
  try {
    const { business_name, website, email, phone, message } = req.body;

    if (!business_name || !website || !email) {
      return res.status(400).json({ success: false });
    }

    await resend.emails.send({
      from: 'Earthy AI <leads@resend.dev>',
      to: LEAD_TO_EMAIL,
      subject: 'New Earthy AI Demo Interest',
      html: `
        <h3>New Demo Request</h3>
        <p><strong>Business:</strong> ${business_name}</p>
        <p><strong>Website:</strong> ${website}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        <p><strong>Message:</strong><br>${message || '—'}</p>
      `
    });

    res.json({ success: true });

  } catch (err) {
    console.error('Resend error:', err);
    res.status(500).json({ success: false });
  }
});

/* ---------------------------
   Server start
---------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Earthy AI server running on port ${PORT}`);
});

