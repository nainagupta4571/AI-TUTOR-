const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config();

const User = require("./models/User");

const app = express();

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGO_URI) {
    console.error("MONGO_URI is missing from .env");
}

if (!JWT_SECRET) {
    console.error("JWT_SECRET is missing from .env");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

let dbConnectionPromise = null;

async function connectDatabase() {
    if (!MONGO_URI) {
        throw new Error("MONGO_URI is not configured");
    }

    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (dbConnectionPromise) {
        return dbConnectionPromise;
    }

    dbConnectionPromise = mongoose
        .connect(MONGO_URI)
        .then(() => {
            console.log("MongoDB connected successfully!");
            return mongoose.connection;
        })
        .catch((error) => {
            dbConnectionPromise = null;
            console.error("MongoDB connection failed:");
            console.error(error.message);
            throw error;
        });

    return dbConnectionPromise;
}

async function requireDatabase(req, res, next) {
    try {
        await connectDatabase();
        next();
    } catch (error) {
        console.error("Database unavailable:", error.message);

        return res.status(503).json({
            message:
                "Database is unavailable. Please check your MongoDB connection."
        });
    }
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/tutor", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "tutor.html"));
});

app.get("/health", async (req, res) => {
    try {
        await connectDatabase();

        return res.status(200).json({
            status: "ok",
            database: "connected"
        });
    } catch (error) {
        return res.status(503).json({
            status: "error",
            database: "disconnected"
        });
    }
});

app.post("/api/register", requireDatabase, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Please fill all fields"
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanName) {
            return res.status(400).json({
                message: "Name is required"
            });
        }

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({
                message: "Please enter a valid email address"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message:
                    "Password must be at least 6 characters"
            });
        }

        const existingUser = await User.findOne({
            email: cleanEmail
        });

        if (existingUser) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(
            password,
            12
        );

        const newUser = new User({
            name: cleanName,
            email: cleanEmail,
            password: hashedPassword
        });

        await newUser.save();

        console.log(
            `New user registered: ${cleanEmail}`
        );

        return res.status(201).json({
            message: "Registration successful!"
        });
    } catch (error) {
        console.error("Registration error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        return res.status(500).json({
            message:
                "Unable to create account. Please try again."
        });
    }
});

app.post("/api/login", requireDatabase, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message:
                    "Email and password are required"
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: cleanEmail
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const passwordMatches =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        if (!JWT_SECRET) {
            console.error(
                "JWT_SECRET is missing from .env"
            );

            return res.status(500).json({
                message: "Server configuration error"
            });
        }

        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email
            },
            JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        console.log(
            `User logged in: ${user.email}`
        );

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message:
                "Unable to login. Please try again."
        });
    }
});

app.post("/api/chat", async (req, res) => {
    const {
        message,
        quizMode = false
    } = req.body || {};

    if (
        !message ||
        typeof message !== "string" ||
        !message.trim()
    ) {
        return res.status(400).json({
            reply: "Please enter a question first."
        });
    }

    const userMessage = message.trim();

    try {
        if (!process.env.OPENROUTER_API_KEY) {
            return res.json({
                reply: getLocalReply(
                    userMessage,
                    quizMode
                )
            });
        }

        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization:
                        `Bearer ${process.env.OPENROUTER_API_KEY}`
                },
                body: JSON.stringify({
                    model:
                        process.env.OPENROUTER_MODEL ||
                        "mistralai/mistral-7b-instruct:free",
                    messages: [
                        {
                            role: "system",
                            content: quizMode
                                ? `
You are an educational quiz generator.

Generate a 5-question multiple-choice quiz
about the topic provided by the student.

For every question provide:
- Question
- A
- B
- C
- D

Do not give the answers unless requested.
Keep the questions educational and clear.
`
                                : `
You are an AI educational tutor.

Explain concepts clearly and simply.
Use examples when useful.
Break difficult topics into small steps.
Avoid unnecessarily complicated language.
`
                        },
                        {
                            role: "user",
                            content: userMessage
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "OpenRouter error:",
                data
            );

            return res.json({
                reply: getLocalReply(
                    userMessage,
                    quizMode
                )
            });
        }

        const reply =
            data?.choices?.[0]?.message?.content?.trim();

        if (!reply) {
            return res.json({
                reply: getLocalReply(
                    userMessage,
                    quizMode
                )
            });
        }

        return res.json({
            reply
        });
    } catch (error) {
        console.error(
            "Chat error:",
            error.message
        );

        return res.json({
            reply: getLocalReply(
                userMessage,
                quizMode
            )
        });
    }
});

function getLocalReply(message, quizMode) {
    const topic = message.trim();

    if (quizMode) {
        return `
Quiz on ${topic}

1. What is the main idea of ${topic}?

A) Option A
B) Option B
C) Option C
D) Option D

2. Which statement best describes ${topic}?

A) Option A
B) Option B
C) Option C
D) Option D

3. Why is ${topic} important?

A) Option A
B) Option B
C) Option C
D) Option D

4. Which is an example of ${topic}?

A) Option A
B) Option B
C) Option C
D) Option D

5. What is a key feature of ${topic}?

A) Option A
B) Option B
C) Option C
D) Option D
`;
    }

    return `
I can help you learn ${topic}.

You can ask me for:
• A simple definition
• A real-world example
• A step-by-step explanation
• A quiz
• Practice questions
`;
}

app.use("/api", (req, res) => {
    res.status(404).json({
        message: "API endpoint not found"
    });
});

app.use((error, req, res, next) => {
    console.error(
        "Unhandled server error:",
        error
    );

    res.status(500).json({
        message: "Internal server error"
    });
});

module.exports = {
    app,
    connectDatabase
};
