const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const genAI = new GoogleGenerativeAI("AIzaSyB4q4SWdgOfFtywZQrV0eUJcHHcQJwdVxU");
// Switched from lite to standard flash for better stability during high demand
const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash" });

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
  res.send('<h1>LiveMeet Translation Server is ONLINE</h1><p>Status: Ready for Science Fair</p>');
});

app.post('/translate', async (req, res) => {
  const { text, targetLang } = req.body;
  
  if (!text || !targetLang) {
    return res.status(400).json({ error: "Missing text or target language" });
  }

  const MAX_RETRIES = 5;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      const prompt = `Act as a professional real-time interpreter. 
                      Translate the following text into natural, spoken ${targetLang}.
                      - If translating to Arabic ('ar'), use clear, Modern Standard Arabic.
                      - Output ONLY the translated text. No quotes or explanations.
                      Text: "${text}"`;
                      
      const result = await model.generateContent(prompt);
      const translatedText = result.response.text().trim();
      
      console.log(`OK (Attempt ${attempt + 1}): "${text}" -> "${translatedText}"`);
      return res.json({ translatedText });

    } catch (error) {
      attempt++;
      const errMsg = error.message.toLowerCase();
      
      // Retry on 503, 504, 429, or general service spikes
      if (errMsg.includes("503") || errMsg.includes("unavailable") || errMsg.includes("429") || errMsg.includes("demand")) {
        const waitTime = attempt * 1000;
        console.log(`Google busy (503). Attempt ${attempt} failed. Retrying in ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // Stop if it's a permanent error (like a bad API key)
        console.error("Permanent Error:", error.message);
        break;
      }
    }
  }

  // Fallback if all 5 tries fail
  console.log("All retries exhausted. Sending original text to prevent app crash.");
  res.status(200).json({ translatedText: text, note: "fallback" });
});

io.on('connection', (socket) => {
  console.log('User Connected:', socket.id);

  socket.on('join-room', (roomCode) => {
    socket.join(roomCode);
    console.log(`User joined room: ${roomCode}`);
  });

  socket.on('send-original', (data) => {
    console.log(`Relaying message from ${data.name}`);
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
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));