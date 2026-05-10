const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const rooms = {};

io.on('connection', (socket) => {
  socket.on('join-room', (roomCode) => {
    socket.join(roomCode);
    if (!rooms[roomCode]) rooms[roomCode] = [];
    rooms[roomCode].push(socket.id);
  });

  socket.on('send-subtitle', ({ roomCode, text, lang }) => {
    socket.to(roomCode).emit('receive-subtitle', { text, lang });
  });
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});