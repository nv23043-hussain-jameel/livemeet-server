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

app.post('/translate', async (req, res) => {
  const { text, targetLang } = req.body;
  
  if (!text || !targetLang) {
    return res.status(400).json({ error: "Missing text or target language" });
  }

  // Increased retries to 5 for better reliability during high demand
  const MAX_RETRIES = 5;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      // UPGRADED PROMPT: Tells the AI to act as a professional interpreter
      const prompt = `Act as a professional real-time interpreter. 
                      Translate the following text into natural, spoken ${targetLang}.
                      - If translating to Arabic ('ar'), use clear, Modern Standard Arabic.
                      - Maintain the original tone and meaning.
                      - Output ONLY the translated text. No quotes, labels, or explanations.
                      Text to translate: "${text}"`;
                      
      const result = await model.generateContent(prompt);
      const translatedText = result.response.text().trim();
      
      console.log(`OK (Attempt ${attempt + 1}): "${text}" -> "${translatedText}" [${targetLang}]`);
      return res.json({ translatedText });

    } catch (error) {
      attempt++;
      const errMsg = error.message.toLowerCase();
      console.error(`Attempt ${attempt} failed:`, error.message);

      // Retry on 503, 504, 429 (Rate Limit), or Service Unavailable
      if (errMsg.includes("503") || errMsg.includes("unavailable") || errMsg.includes("429") || errMsg.includes("demand")) {
        // Wait longer each time (Exponential Backoff: 1s, 2s, 3s...)
        const waitTime = attempt * 1000;
        console.log(`Retrying in ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        break;
      }
    }
  }

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