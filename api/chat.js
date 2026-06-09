// /api/chat.js

const GROQ_KEYS = [
  "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",  // ← ganti dengan key kamu
  "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",  // ← ganti dengan key kamu
  "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",  // ← ganti dengan key kamu
  "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", 
  "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",
  "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",
  "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",
  "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",
  "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",
  "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",
].filter(Boolean);

const GROQ_MODEL = "llama-3.1-8b-instant";

let keyIndex = 0;

function getNextKey() {
  const key = GROQ_KEYS[keyIndex];
  keyIndex = (keyIndex + 1) % GROQ_KEYS.length;
  return key;
}

async function callGroq(messages, attempt = 0) {
  if (attempt >= GROQ_KEYS.length) {
    throw new Error("Semua API key sedang rate limited");
  }

  const key = getNextKey();

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (groqRes.status === 429) {
    console.warn(`Key ke-${attempt + 1} rate limited, coba key berikutnya...`);
    return callGroq(messages, attempt + 1);
  }

  return groqRes;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Field 'messages' harus berupa array" });
    }

    if (GROQ_KEYS.length === 0) {
      return res.status(500).json({ error: "Tidak ada API key yang tersedia" });
    }

    const groqRes = await callGroq(messages);
    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({ error: data.error?.message || "Groq API error" });
    }

    return res.status(200).json({
      reply: data.choices[0].message.content,
    });

  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
