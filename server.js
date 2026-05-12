const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
// Updated to Gemini 3.1 Flash-Lite (Stable GA May 2026)
const genAI = new GoogleGenerativeAI("AIzaSyCG9pJXTzWiAItsfkp1jkTAJb6ymOuM_xo");
const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

const app = express();
app.use(cors());
app.use(express.json());

// Incoming Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// TEST ROUTE
app.get('/', (req, res) => {
  res.send('<h1>LiveMeet Translation Server is ONLINE</h1><p>Powered by Gemini 3.1 Flash-Lite</p>');
});

// Endpoint for translation
app.post('/translate', async (req, res) => {
  const { text, targetLang } = req.body;
  
  if (!text || !targetLang) {
    return res.status(400).json({ error: "Missing text or target language" });
  }

  try {
    // SYSTEM PROMPT: Forces the model to only return the translated string.
    const prompt = `Task: Translate the following text into the language with ISO code "${targetLang}". 
                    Constraint: Output ONLY the translated text. Do not include quotes, explanations, or labels.
                    Text: "${text}"`;
                    
    const result = await model.generateContent(prompt);
    const translatedText = result.response.text().trim();
    
    console.log(`OK: "${text}" -> "${translatedText}" [${targetLang}]`);
    res.json({ translatedText });
  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Translation failed", detail: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('User Connected:', socket.id);

  socket.on('join-room', (roomCode) => {
    socket.join(roomCode);
    console.log(`User ${socket.id} joined room: ${roomCode}`);
  });

  socket.on('send-original', (data) => {
    console.log(`Relaying message from ${data.name} in room ${data.roomCode}`);
    // Broadcast to everyone ELSE in the room
    socket.to(data.roomCode).emit('receive-original', {
      text: data.text,
      name: data.name
    });
  });

  socket.on('disconnect', () => {
    console.log('User Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));