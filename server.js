const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const genAI = new GoogleGenerativeAI("AIzaSyB4q4SWdgOfFtywZQrV0eUJcHHcQJwdVxU");
const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.get('/', (req, res) => {
  res.send('<h1>LiveMeet Translation Server is ONLINE</h1><p>Powered by Gemini 3.1 Flash-Lite</p>');
});

// Endpoint for translation with RETRY LOGIC for 503 errors
app.post('/translate', async (req, res) => {
  const { text, targetLang } = req.body;
  
  if (!text || !targetLang) {
    return res.status(400).json({ error: "Missing text or target language" });
  }

  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      const prompt = `Task: Translate the following text into the language with ISO code "${targetLang}". 
                      Constraint: Output ONLY the translated text. Do not include quotes or explanations.
                      Text: "${text}"`;
                      
      const result = await model.generateContent(prompt);
      const translatedText = result.response.text().trim();
      
      console.log(`OK (Attempt ${attempt + 1}): "${text}" -> "${translatedText}" [${targetLang}]`);
      return res.json({ translatedText });

    } catch (error) {
      attempt++;
      console.error(`Attempt ${attempt} failed:`, error.message);

      // If it's a 503 (High Demand) error, wait 1.5 seconds and try again
      if (error.message.includes("503") || error.message.includes("Service Unavailable") || error.message.includes("high demand")) {
        console.log("Server busy, retrying in 1.5s...");
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        // If it's a 403 or 400 (logic error), stop retrying
        break;
      }
    }
  }

  // Final Fallback: If all retries fail, we send the original text so the app doesn't crash
  console.log("All retries exhausted. Sending original text.");
  res.status(200).json({ translatedText: text, note: "fallback" });
});

io.on('connection', (socket) => {
  console.log('User Connected:', socket.id);

  socket.on('join-room', (roomCode) => {
    socket.join(roomCode);
    console.log(`User ${socket.id} joined room: ${roomCode}`);
  });

  socket.on('send-original', (data) => {
    console.log(`Relaying message from ${data.name} in room ${data.roomCode}`);
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