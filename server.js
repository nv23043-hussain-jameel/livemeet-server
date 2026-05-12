const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
// Using Gemini 2.5 Flash (Stable LTS) for maximum reliability
const genAI = new GoogleGenerativeAI("AIzaSyB4q4SWdgOfFtywZQrV0eUJcHHcQJwdVxU");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const app = express();
app.use(cors());
app.use(express.json());

// Logger to track traffic during your presentation
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.get('/', (req, res) => {
  res.send('<h1>LiveMeet Server: STATUS ONLINE</h1><p>Model: Gemini 2.5 Flash (LTS)</p>');
});

// Translation Endpoint with Exponential Backoff
app.post('/translate', async (req, res) => {
  const { text, targetLang } = req.body;
  
  if (!text || !targetLang) {
    return res.status(400).json({ error: "Missing data" });
  }

  const MAX_RETRIES = 5;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      const prompt = `Translate this text to ${targetLang}. Output ONLY the translation: "${text}"`;
      const result = await model.generateContent(prompt);
      const translatedText = result.response.text().trim();
      
      console.log(`SUCCESS: ${text} -> ${translatedText}`);
      return res.json({ translatedText });

    } catch (error) {
      attempt++;
      const isServiceError = error.message.includes("503") || error.message.includes("demand");
      
      if (isServiceError && attempt < MAX_RETRIES) {
        const wait = attempt * 1000;
        console.log(`Server Busy. Retry ${attempt}/${MAX_RETRIES} in ${wait}ms...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        console.error("Translation failed:", error.message);
        break;
      }
    }
  }

  // Fallback so the app doesn't stay blank
  res.json({ translatedText: text, note: "fallback" });
});

io.on('connection', (socket) => {
  console.log('User Connected:', socket.id);

  socket.on('join-room', (roomCode) => {
    socket.join(roomCode);
    console.log(`Room Joined: ${roomCode}`);
  });

  socket.on('send-original', (data) => {
    // Relay original message to other phones in the room
    socket.to(data.roomCode).emit('receive-original', {
      text: data.text,
      name: data.name
    });
  });

  socket.on('disconnect', () => {
    console.log('User Disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));