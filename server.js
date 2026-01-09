const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/chat', async (req, res) => {
  try {
    const { input, history } = req.body;

    const messages = (Array.isArray(history) ? history.map(m => ({
      role: m.author === 'user' ? 'user' : 'assistant',
      content: m.text
    })) : []);

    messages.push({ role: "user", content: input });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages
    });

    const reply = response.choices?.[0]?.message?.content || "🤖 AI did not respond.";

    res.json({
      reply,
      history: [...(history || []), { author: "user", text: input }, { author: "ai", text: reply }]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "⚠️ AI call failed.", history: history || [] });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
