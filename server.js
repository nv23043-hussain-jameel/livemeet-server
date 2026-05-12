const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const genAI = new GoogleGenerativeAI("AIzaSyCG9pJXTzWiAItsfkp1jkTAJb6ymOuM_xo");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`INCOMING REQUEST: ${req.method} ${req.path}`);
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// TEST ROUTE: Open your Render URL in a browser to see if it's awake
app.get('/', (req, res) => {
  res.send('Translation Server is Live!');
});

// Endpoint for the phone to request a high-quality translation
app.post('/translate', async (req, res) => {
  const { text, targetLang } = req.body;
  
  if (!text || !targetLang) {
    return res.status(400).json({ error: "Missing text or target language" });
  }

  try {
    // We give Gemini a very strict prompt so it doesn't add conversational filler
    const prompt = `Translate the following text into the language with ISO code "${targetLang}". 
                    Only return the translated text. Do not include quotes or explanations.
                    Text: "${text}"`;
                    
    const result = await model.generateContent(prompt);
    const translatedText = result.response.text().trim();
    
    console.log(`Successfully translated: "${text}" to "${translatedText}" [Target: ${targetLang}]`);
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
    // data should contain: roomCode, text, name
    console.log(`Message from ${data.name} in room ${data.roomCode}: ${data.text}`);
    
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