import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export const initializeSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('Connected to socket:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from socket');
    });
  }

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

export const emitUserJoin = (username) => {
  const socket = getSocket();
  console.log(`👤 Emitting user_join for ${username}, socket connected: ${socket.connected}`);
  socket.emit('user_join', { username });
  console.log(`✅ user_join emitted successfully`);
};

export const emitSendMessage = (sender, receiver, text, replyTo = null, messageData = null) => {
  const socket = getSocket();
  // If we have the full saved message, emit that instead (includes _id)
  if (messageData) {
    socket.emit('send_message', messageData);
  } else {
    socket.emit('send_message', { sender, receiver, text, replyTo });
  }
};

export const emitDeleteMessage = (messageId) => {
  const socket = getSocket();
  socket.emit('delete_message', { messageId });
};

export const emitDeleteMessageForMe = (messageId, username) => {
  const socket = getSocket();
  socket.emit('delete_message_for_me', { messageId, username });
};

export const emitTyping = (username, receiver) => {
  const socket = getSocket();
  socket.emit('user_typing', { username, receiver });
};

export const emitStopTyping = (username, receiver) => {
  const socket = getSocket();
  socket.emit('user_stop_typing', { username, receiver });
};

export const emitUserLogout = (username) => {
  const socket = getSocket();
  socket.emit('user_logout', { username });
};

export const onReceiveMessage = (callback) => {
  const socket = getSocket();
  socket.on('receive_message', callback);
  
  // Return unsubscribe function
  return () => {
    socket.off('receive_message', callback);
  };
};

export const onUserOnline = (callback) => {
  const socket = getSocket();
  socket.on('user_online', callback);
};

export const onUserOffline = (callback) => {
  const socket = getSocket();
  socket.on('user_offline', callback);
};

export const onTypingIndicator = (callback) => {
  const socket = getSocket();
  socket.on('typing_indicator', callback);
};

export const onStopTyping = (callback) => {
  const socket = getSocket();
  socket.on('stop_typing', callback);
};

export const onMessagesRead = (callback) => {
  const socket = getSocket();
  socket.on('messages_read', callback);
};

export const onDeleteMessage = (callback) => {
  const socket = getSocket();
  socket.on('message_deleted', callback);
};

export const onDeleteMessageForMe = (callback) => {
  const socket = getSocket();
  socket.on('message_deleted_for_me', callback);
};

// WebRTC Call Events
export const emitCallUser = (to, from, offer) => {
  const socket = getSocket();
  socket.emit('call-user', { to, from, offer });
};

export const onCallUser = (callback) => {
  const socket = getSocket();
  socket.on('call-user', callback);
};

export const emitAnswerCall = (to, from, answer) => {
  const socket = getSocket();
  socket.emit('answer-call', { to, from, answer });
};

export const onAnswerCall = (callback) => {
  const socket = getSocket();
  socket.on('answer-call', callback);
};

export const emitIceCandidate = (to, candidate) => {
  const socket = getSocket();
  socket.emit('ice-candidate', { to, candidate });
};

export const onIceCandidate = (callback) => {
  const socket = getSocket();
  socket.on('ice-candidate', callback);
};

export const emitEndCall = (to, from, reason) => {
  const socket = getSocket();
  socket.emit('end-call', { to, from, reason });
};

export const onEndCall = (callback) => {
  const socket = getSocket();
  socket.on('end-call', callback);
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
