import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import { google } from "googleapis";

const app = express();
app.use(bodyParser.json({ limit: "200kb" }));

const { OPENAI_API_KEY, SHEET_ID, PORT } = process.env;

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const SYSTEM_PROMPT =
  "Earthy AI, embedded on a digital marketing website, created by Dalha. " +
  "You are a warm, patient, and helpful conversational assistant. " +
  "Rules: never reset conversations, never repeat greetings or questions, " +
  "ask only ONE question at a time, and prioritize lead generation. " +
  "Always aim to collect contact info naturally.";

function isValidHistoryArray(h) {
  return Array.isArray(h) && h.every(
    m =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string"
  );
}

function isValidEmail(email) {
  return typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function generateAssistantReply(messages) {
  const resp = await openai.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.2,
    max_tokens: 800
  });

  return resp.choices[0].message.content;
}

async function appendToSheet({ name, businessType, email }) {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const sheets = google.sheets({
    version: "v4",
    auth: await auth.getClient()
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "A:D",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[name, businessType, email, new Date().toISOString()]]
    }
  });
}

app.post("/chat", async (req, res) => {
  const { input, history = [] } = req.body;

  if (!input || typeof input !== "string") {
    return res.status(400).json({ error: "Invalid input" });
  }

  if (!isValidHistoryArray(history)) {
    return res.status(400).json({ error: "Invalid history format" });
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: input }
  ];

  const reply = await generateAssistantReply(messages);

  const updatedHistory = [
    ...history,
    { role: "user", content: input },
    { role: "assistant", content: reply }
  ];

  res.json({
    reply,
    history: updatedHistory
  });
});

app.get("/", (_, res) => {
  res.send("Earthy AI server is running 🚀");
});

app.listen(PORT || 3000, () => {
  console.log(`Server live on port ${PORT || 3000}`);
});