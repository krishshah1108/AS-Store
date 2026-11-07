const { Server } = require('socket.io');

let io = null;

function initSocket(server, corsOrigin) {
  io = new Server(server, {
    cors: { origin: corsOrigin },
  });
}

function emitChange() {
  if (!io) return;
  io.emit('data:changed');
}

module.exports = { initSocket, emitChange };
