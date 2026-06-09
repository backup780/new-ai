// ============================================================
//  Astra AI — Vercel Serverless Function
//  File: /api/chat.js
//  Ganti YOUR_GROQ_API_KEY_HERE dengan API key Groq kamu
// ============================================================

const GROQ_API_KEY = "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"; // ← ganti di sini
const GROQ_MODEL   = "llama-3.1-8b-instant";

export default async function handler(req, res) {
  // ── CORS headers ─────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Field 'messages' harus berupa array" });
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        messages,
        max_tokens:  2048,
        temperature: 0.7,
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({ error: data.error?.message || "Groq API error" });
    }

    return res.status(200).json({
      reply: data.choices[0].message.content,
    });

  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Internal server error: " + err.message });
  }
}
