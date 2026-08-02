const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const modeLabel = document.getElementById('mode-label');
const themeLabel = document.getElementById('mode-theme');
const themeToggle = document.getElementById('themeToggle');
const quizToggle = document.getElementById('quiz-toggle');

let quizMode = false;
let isDark = localStorage.getItem('ai_tutor_theme') === 'dark';

function ensureAuth() {
  const token = localStorage.getItem('ai_tutor_token');
  if (!token) {
    window.location.href = '/login';
  }
}

function setTheme() {
  document.body.classList.toggle('dark', isDark);
  themeLabel.textContent = isDark ? '🌙 Dark Mode' : '☀️ Light Mode';
  if (themeToggle) themeToggle.checked = isDark;
}

function toggleTheme() {
  isDark = !isDark;
  localStorage.setItem('ai_tutor_theme', isDark ? 'dark' : 'light');
  setTheme();
}

function toggleMode() {
  quizMode = quizToggle.checked;
  modeLabel.textContent = quizMode ? '🧠 Quiz Mode' : '🧠 Tutor Mode';
}

function appendMessage(text, type = 'bot') {
  const message = document.createElement('div');
  message.className = `message ${type === 'user' ? 'user-msg' : 'bot-msg'}`;
  message.textContent = text;
  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function setLoading(isLoading) {
  const button = document.querySelector('.input-area button');
  if (button) {
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Thinking...' : 'Send';
  }
}

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  appendMessage(message, 'user');
  userInput.value = '';
  setLoading(true);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('ai_tutor_token') || ''}`
      },
      body: JSON.stringify({ message, quizMode })
    });

    const data = await response.json();
    appendMessage(data.reply || 'Sorry, I could not answer that.', 'bot');
  } catch (error) {
    appendMessage('Could not reach the tutor server. Please try again.', 'bot');
  } finally {
    setLoading(false);
  }
}

function logoutUser() {
  localStorage.removeItem('ai_tutor_token');
  localStorage.removeItem('ai_tutor_user');
  window.location.href = '/login';
}

function exportToPDF() {
  window.print();
}

function exportToDOCX() {
  const lines = Array.from(chatWindow.querySelectorAll('.message'))
    .map((msg) => msg.textContent)
    .join('\n\n');
  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'ai-tutor-conversation.txt';
  link.click();
  URL.revokeObjectURL(link.href);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ensureAuth();
    setTheme();
    toggleMode();
    appendMessage('Hi! I’m your AI Tutor. Ask me anything.', 'bot');
    document.querySelector('.input-area button').addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
      }
    });
    if (themeToggle) themeToggle.addEventListener('change', toggleTheme);
    if (quizToggle) quizToggle.addEventListener('change', toggleMode);
  });
} else {
  ensureAuth();
  setTheme();
  toggleMode();
  appendMessage('Hi! I’m your AI Tutor. Ask me anything.', 'bot');
  document.querySelector('.input-area button').addEventListener('click', sendMessage);
  userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendMessage();
    }
  });
  if (themeToggle) themeToggle.addEventListener('change', toggleTheme);
  if (quizToggle) quizToggle.addEventListener('change', toggleMode);
}

window.sendMessage = sendMessage;
window.toggleMode = toggleMode;
window.toggleTheme = toggleTheme;
window.logoutUser = logoutUser;
window.exportToPDF = exportToPDF;
window.exportToDOCX = exportToDOCX;
