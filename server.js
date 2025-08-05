import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Debug: check if key loaded
console.log("Loaded Groq API Key:", process.env.GROQ_API_KEY ? "✅ Found" : "❌ Missing");

app.get("/", (req, res) => {
  res.send("✅ Voice Bot backend (Groq API) is running!");
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ reply: "Please say something." });
    }

    if (!process.env.GROQ_API_KEY) {
      console.error("❌ Missing Groq API key");
      return res.status(500).json({ reply: "Missing API key" });
    }

    const completion = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
          { role: "system", content: "You are a friendly and thoughtful AI assistant. Speak conversationally and clearly." },
          { role: "user", content: message }
        ]
      })
    });

    const result = await completion.json();

    // Debug: print raw API result
    console.log("Groq API Raw Response:", JSON.stringify(result, null, 2));

    if (!result.choices || !result.choices[0].message) {
      console.error("❌ Groq API Error:", result);
      return res.status(500).json({ reply: "Error from Groq API." });
    }

    res.json({ reply: result.choices[0].message.content });

  } catch (error) {
    console.error("❌ Server Error:", error);
    res.status(500).json({ reply: "Internal server error." });
  }
});

app.listen(3000, () => console.log("✅ Server running on http://localhost:3000"));
