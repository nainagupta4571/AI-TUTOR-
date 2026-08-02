const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config();

const User = require("./models/User");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname), { index: false }));

let dbConnectionPromise = null;

function connectToDatabase() {
  if (!dbConnectionPromise) {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai_tutor";
    dbConnectionPromise = mongoose
      .connect(mongoUri)
      .then(() => {
        console.log("MongoDB connected!");
      })
      .catch((error) => {
        console.log("MongoDB connection error:", error);
      });
  }

  return dbConnectionPromise;
}

if (process.env.NODE_ENV !== "test") {
  connectToDatabase();
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/tutor", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tutor.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "dev_secret", { expiresIn: "1d" });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.log("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/chat", async (req, res) => {
  const { message, quizMode = false } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ reply: "Please enter a question first." });
  }

  try {
    if (process.env.OPENROUTER_API_KEY) {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "mistralai/mistral-7b-instruct:free",
          messages: [
            {
              role: "system",
              content: quizMode
                ? "You are an educational quiz generator. Generate a 5-question multiple choice quiz on the given topic. Do not explain, just return the quiz."
                : "You are an educational AI tutor. Explain concepts clearly and simply.",
            },
            {
              role: "user",
              content: message,
            },
          ],
        }),
      });

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't answer that.";
      return res.json({ reply });
    }

    return res.json({ reply: getLocalReply(message, quizMode) });
  } catch (error) {
    console.error("Chat error:", error);
    return res.json({ reply: getLocalReply(message, quizMode) });
  }
});

function getLocalReply(message, quizMode) {
  const topic = message.trim();

  if (quizMode) {
    return `Quiz on ${topic}:\n1) What is the main idea?\nA) Option A\nB) Option B\nC) Option C\nD) Option D`;
  }

  if (/javascript|node|react/i.test(topic)) {
    return `I can help with ${topic}. A simple way to think about it is: break the problem into smaller steps, test each step, and keep your code readable.`;
  }

  return `I can help with ${topic}. Try asking for a definition, example, or step-by-step explanation.`;
}

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email: email.toLowerCase(), password: hashedPassword });

    await newUser.save();
    console.log("New user registered:", email);
    res.status(201).json({ message: "Registration successful!" });
  } catch (error) {
    console.log("Registration error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = { app };
