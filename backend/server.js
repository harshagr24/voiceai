import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// =========================
// MongoDB Connection
// =========================
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Connection Error:", err));

// =========================
// Chat Schema
// =========================
const chatSchema = new mongoose.Schema({
  conversationId: String,
  messages: [
    {
      role: String, // "user" or "bot"
      text: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
});
const Chat = mongoose.model("Chat", chatSchema);

// =========================
// Routes
// =========================

// Root route
app.get("/", (req, res) => {
  res.send("✅ AI Voice Bot API is running!");
});

// POST /api/chat → Send message to Groq, store in DB
app.post("/api/chat", async (req, res) => {
  try {
    let { message, conversationId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!conversationId) {
      conversationId = uuidv4();
    }

    // Call Groq API with supported model
    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile", // ✅ Supported model
          messages: [
            { role: "system", content: "You are a helpful AI assistant that answers naturally." },
            { role: "user", content: message }
          ],
          temperature: 0.7,
        }),
      }
    );

    const result = await groqResponse.json();
    console.log("📌 Groq API Raw Response:", JSON.stringify(result, null, 2));

    if (result.error) {
      console.error("❌ Groq API Error:", result.error);
      return res.status(500).json({ error: result.error.message });
    }

    // Handle both OpenAI-style and Groq-style responses
    const botReply =
      result?.choices?.[0]?.message?.content?.trim() ||
      result?.choices?.[0]?.text?.trim() ||
      "Sorry, I couldn't generate a reply.";

    // Save conversation to DB
    let chat = await Chat.findOne({ conversationId });
    if (!chat) {
      chat = new Chat({ conversationId, messages: [] });
    }
    chat.messages.push({ role: "user", text: message });
    chat.messages.push({ role: "bot", text: botReply });
    await chat.save();

    res.json({ reply: botReply, conversationId });

  } catch (error) {
    console.error("❌ Error in /api/chat:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /api/history → List all conversations with first message as title
app.get("/api/history", async (req, res) => {
  try {
    const chats = await Chat.find({}, { conversationId: 1, messages: 1, _id: 0 });

    const history = chats.map(chat => ({
      conversationId: chat.conversationId,
      title: chat.messages.find(m => m.role === "user")?.text || "New Conversation"
    }));

    res.json(history);
  } catch (error) {
    console.error("❌ Error fetching history:", error);
    res.status(500).json({ error: "Error fetching history" });
  }
});

// GET /api/history/:id → Get messages from specific conversation
app.get("/api/history/:id", async (req, res) => {
  try {
    const chat = await Chat.findOne({ conversationId: req.params.id });
    if (!chat) return res.status(404).json({ error: "Conversation not found" });
    res.json(chat);
  } catch (error) {
    console.error("❌ Error fetching conversation:", error);
    res.status(500).json({ error: "Error fetching conversation" });
  }
});

// =========================
// Start Server
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
