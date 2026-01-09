import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // your key set in Railway variables
});

app.post('/chat', async (req, res) => {
  try {
    const { input, history } = req.body;

    // call OpenAI GPT
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        ...(Array.isArray(history) ? history.map(m => ({ role: m.author === 'user' ? 'user' : 'assistant', content: m.text })) : []),
        { role: "user", content: input }
      ]
    });

    const reply = response.choices?.[0]?.message?.content || "🤖 AI did not respond.";

    // return in the exact shape frontend expects
    res.json({
      reply,
      history: [...(history || []), { author: "user", text: input }, { author: "ai", text: reply }]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "⚠️ AI call failed.", history: history || [] });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running 🚀");
});
