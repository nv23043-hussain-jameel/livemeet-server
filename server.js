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

  socket.on('send-original', ({ roomCode, text, name }) => {
    socket.to(roomCode).emit('receive-original', { text, name });
  });
});

setInterval(() => {
  console.log('keeping server alive...');
}, 1000 * 60 * 5);

server.listen(3000, () => {
  console.log('Server running on port 3000');
});