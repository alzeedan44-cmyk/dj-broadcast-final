const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const ROOM_PINS = {
  // Example: "party123": "8888"
};

const rooms = {};
const recordingStreams = {};

io.on('connection', socket => {
  console.log('conn', socket.id);

  socket.on('joinRoom', ({ room, role, name, pin }) => {
    if (!room) return;
    if (ROOM_PINS[room] && ROOM_PINS[room] !== pin) {
      socket.emit('join-failed', { reason: 'Invalid PIN' });
      return;
    }
    socket.join(room);
    socket.data.room = room;
    socket.data.role = role;
    socket.data.name = name || socket.id;
    if (!rooms[room]) rooms[room] = { djId: null, listeners: new Set() };
    if (role === 'dj') {
      rooms[room].djId = socket.id;
      io.to(room).emit('status', { type: 'dj-online', djId: socket.id });
    } else {
      rooms[room].listeners.add(socket.id);
      const djId = rooms[room].djId;
      if (djId) io.to(djId).emit('listener-joined', { listenerId: socket.id, name: socket.data.name });
    }
    io.to(room).emit('roster', { djId: rooms[room].djId, listeners: Array.from(rooms[room].listeners) });
    socket.emit('join-success', { room, djId: rooms[room].djId });
  });

  socket.on('leaveRoom', () => {
    const room = socket.data.room;
    if (!room || !rooms[room]) return;
    socket.leave(room);
    if (socket.data.role === 'dj') {
      rooms[room].djId = null;
      io.to(room).emit('status', { type: 'dj-offline' });
    } else {
      rooms[room].listeners.delete(socket.id);
      const djId = rooms[room].djId;
      if (djId) io.to(djId).emit('listener-left', { listenerId: socket.id });
    }
    io.to(room).emit('roster', { djId: rooms[room].djId, listeners: Array.from(rooms[room].listeners) });
    socket.data.room = null;
    socket.data.role = null;
  });

  socket.on('offer', ({ targetId, sdp }) => { io.to(targetId).emit('offer', { fromId: socket.id, sdp }); });
  socket.on('answer', ({ targetId, sdp }) => { io.to(targetId).emit('answer', { fromId: socket.id, sdp }); });
  socket.on('ice-candidate', ({ targetId, candidate }) => { io.to(targetId).emit('ice-candidate', { fromId: socket.id, candidate }); });

  socket.on('chat', ({ room, name, text }) => { if (!room) return; io.to(room).emit('chat', { name: name||'Anon', text, ts: Date.now() }); });

  socket.on('record-start', ({ room }) => {
    if (!room) return;
    const recDir = path.join(__dirname, 'recordings');
    if (!fs.existsSync(recDir)) fs.mkdirSync(recDir);
    const filename = `${room}_${Date.now()}.webm`;
    const filepath = path.join(recDir, filename);
    try {
      const ws = fs.createWriteStream(filepath, { flags: 'a' });
      recordingStreams[room] = { stream: ws, filename };
      socket.emit('record-started', { filename });
      console.log('Recording started', filename);
    } catch (e) { console.error('record start error', e); }
  });

  socket.on('record-chunk', ({ room, buffer }) => {
    if (!room || !recordingStreams[room]) return;
    const buf = Buffer.from(buffer);
    try { recordingStreams[room].stream.write(buf); } catch (e) { console.error('write chunk failed', e); }
  });

  socket.on('record-stop', ({ room }) => {
    if (!room || !recordingStreams[room]) return;
    try { recordingStreams[room].stream.end(); } catch(e) {}
    io.to(room).emit('record-saved', { filename: recordingStreams[room].filename });
    console.log('Recording saved', recordingStreams[room].filename);
    delete recordingStreams[room];
  });

  socket.on('disconnect', () => {
    const room = socket.data.room;
    if (!room || !rooms[room]) return;
    if (socket.data.role === 'dj') { rooms[room].djId = null; io.to(room).emit('status', { type: 'dj-offline' }); }
    else { rooms[room].listeners.delete(socket.id); const djId = rooms[room].djId; if (djId) io.to(djId).emit('listener-left', { listenerId: socket.id }); }
    io.to(room).emit('roster', { djId: rooms[room].djId, listeners: Array.from(rooms[room].listeners) });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server listening on', PORT));
