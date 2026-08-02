let quizMode = false;

function ensureAuthenticated() {
  const token = localStorage.getItem("ai_tutor_token");
  if (!token) {
    window.location.href = "/login";
    return false;
  }
  return true;
}

if (window.location.pathname === "/tutor" && !ensureAuthenticated()) {
  window.location.replace("/login");
}

function attachInputHandler() {
  if (!ensureAuthenticated()) return;
  const input = document.getElementById("user-input");
  if (!input) return;

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });
}

async function sendMessage() {
  if (!ensureAuthenticated()) return;

  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (!message) return;

  appendMessage("user", message);
  input.value = "";
  appendMessage("bot", "🤖 Typing...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ai_tutor_token") || ""}`,
      },
      body: JSON.stringify({
        message,
        quizMode,
      }),
    });

    const data = await response.json();
    const reply = data.reply || "Sorry, I couldn't answer that.";
    updateLastBotMessage(reply);
  } catch (err) {
    console.error(err);
    updateLastBotMessage("There was an error reaching the AI.");
  }
}

function appendMessage(sender, text) {
  const chatWindow = document.getElementById("chat-window");
  const msg = document.createElement("div");
  msg.className = sender === "user" ? "user-msg" : "bot-msg";
  msg.textContent = text;
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function updateLastBotMessage(newText) {
  const messages = document.querySelectorAll(".bot-msg");
  if (messages.length > 0) {
    const msg = messages[messages.length - 1];
    msg.classList.add("animate-in");
    msg.innerHTML = newText.replace(/\n/g, "<br>");
  }
}

function toggleTheme() {
  document.body.classList.toggle("dark");
}

function logoutUser() {
  localStorage.removeItem("ai_tutor_token");
  localStorage.removeItem("ai_tutor_user");
  window.location.href = "/";
}

function exportToPDF() {
  const chatWindow = document.getElementById("chat-window");
  const messages = chatWindow.querySelectorAll(".user-msg, .bot-msg");

  let content = "";
  messages.forEach((msg) => {
    const role = msg.classList.contains("user-msg") ? "You" : "AI Tutor";
    content += `${role}: ${msg.textContent}\n\n`;
  });

  const blob = new Blob([content], { type: "application/pdf" });

  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  script.onload = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(content, 180);
    doc.text(lines, 10, 10);
    doc.save("AI_Tutor_Chat.pdf");
  };
  document.body.appendChild(script);
}

function toggleMode() {
  quizMode = document.getElementById("quiz-toggle").checked;
  const label = document.getElementById("mode-label");
  label.textContent = quizMode ? "📝 Quiz Mode" : "🧠 Tutor Mode";
}

function getChatText() {
  const chatWindow = document.getElementById("chat-window");
  const messages = chatWindow.querySelectorAll(".user-msg, .bot-msg");
  let content = "";
  messages.forEach((msg) => {
    const role = msg.classList.contains("user-msg") ? "You" : "AI Tutor";
    content += `${role}: ${msg.textContent}\n\n`;
  });
  return content;
}

function exportToTXT() {
  const content = getChatText();
  const blob = new Blob([content], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "AI_Tutor_Chat.txt";
  link.click();
}

function exportToDOCX() {
  const content = getChatText();
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' 
                      xmlns:w='urn:schemas-microsoft-com:office:word' 
                      xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>AI Chat</title></head>
    <body><pre>${content}</pre></body>
  </html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "AI_Tutor_Chat.doc";
  link.click();
}

document.addEventListener("DOMContentLoaded", attachInputHandler);
