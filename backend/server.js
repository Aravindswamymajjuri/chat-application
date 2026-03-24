const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();
const server = http.createServer(app);
const allowedOriginsIO = [
  'http://localhost:5173',      // Local development
  process.env.FRONTEND_URL      // Deployed frontend
].filter(Boolean);              // Remove undefined values

const io = socketIO(server, {
  cors: {
    origin: allowedOriginsIO,
    methods: ['GET', 'POST']
  }
});

// Database
const connectDB = require('./config/database');
connectDB();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',      // Local development
  process.env.FRONTEND_URL      // Deployed frontend
].filter(Boolean);              // Remove undefined values

app.use(cors({
  origin: allowedOrigins
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📍 ${req.method} ${req.path}`);
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const chatRoutes = require('./routes/chat');
const notificationRoutes = require('./routes/notification');
const chatController = require('./controllers/chatController');

// Track connected users: { username: socketId }
const connectedUsers = {};

// Initialize chat controller with io instance and connectedUsers map for real-time updates
chatController.setIO(io, connectedUsers);

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Chat Application Backend Running' });
});

// Socket.IO Events
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When user joins
  socket.on('user_join', (data) => {
    const { username } = data;
    console.log(`\n${'='.repeat(50)}`);
    console.log(`👤 User ${username} joined with socket ${socket.id}`);
    connectedUsers[username] = socket.id;
    console.log(`📊 Connected users map now:`, Object.entries(connectedUsers).map(([u, id]) => `${u}: ${id.substring(0, 8)}...`).join(', '));
    console.log(`${'='.repeat(50)}\n`);
    
    socket.broadcast.emit('user_online', {
      username,
      status: 'online'
    });
  });

  // Send message event
  socket.on('send_message', (data) => {
    console.log(`Message from ${data.sender} to ${data.receiver}: ${data.text}`);
    
    // Emit to all OTHER clients (not back to sender)
    // Sender already added message locally via onMessageSent callback
    // If data has _id (full saved message), emit it as-is; otherwise construct a new object
    const messageToSend = data._id ? data : {
      sender: data.sender,
      receiver: data.receiver,
      text: data.text,
      replyTo: data.replyTo || null,
      timestamp: new Date()
    };
    socket.broadcast.emit('receive_message', messageToSend);
  });

  // Delete message for everyone
  socket.on('delete_message', (data) => {
    console.log(`Message ${data.messageId} deleted by user`);
    socket.broadcast.emit('message_deleted', {
      messageId: data.messageId
    });
  });

  // Delete message for me only
  socket.on('delete_message_for_me', (data) => {
    console.log(`Message ${data.messageId} deleted for ${data.username}`);
    socket.broadcast.emit('message_deleted_for_me', {
      messageId: data.messageId,
      username: data.username
    });
  });

  // Typing indicator
  socket.on('user_typing', (data) => {
    socket.broadcast.emit('typing_indicator', {
      username: data.username,
      receiver: data.receiver
    });
  });

  // Stop typing
  socket.on('user_stop_typing', (data) => {
    socket.broadcast.emit('stop_typing', {
      username: data.username,
      receiver: data.receiver
    });
  });

  // User disconnects
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Remove user from connectedUsers
    for (const [username, socketId] of Object.entries(connectedUsers)) {
      if (socketId === socket.id) {
        delete connectedUsers[username];
        console.log(`Removed ${username} from connected users`);
        break;
      }
    }
    socket.broadcast.emit('user_offline', {
      socketId: socket.id,
      status: 'offline'
    });
  });

  // Explicit logout
  socket.on('user_logout', (data) => {
    console.log(`User ${data.username} logged out`);
    delete connectedUsers[data.username];
    socket.broadcast.emit('user_offline', {
      username: data.username,
      status: 'offline'
    });
  });

  // WebRTC Call Events
  socket.on('call-user', (data) => {
    const { to, from, offer } = data;
    const recipientSocketId = connectedUsers[to];
    
    console.log(`📞 Call initiated: ${from} → ${to}`);
    console.log(`   looking for user "${to}" in map:`, connectedUsers);
    console.log(`   Recipient socket ID: ${recipientSocketId}`);
    
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('call-user', {
        from,
        offer
      });
      console.log(`   ✅ Call signal sent to ${to}`);
    } else {
      // Notify caller that recipient is offline
      console.log(`   ❌ User ${to} not found in connectedUsers map`);
      io.to(socket.id).emit('user-offline', {
        message: `${to} is offline`
      });
    }
  });

  socket.on('answer-call', (data) => {
    const { to, from, answer } = data;
    const callerSocketId = connectedUsers[to];
    
    console.log(`✅ Call answered: ${from} → ${to}`);
    
    if (callerSocketId) {
      io.to(callerSocketId).emit('answer-call', {
        from,
        answer
      });
    }
  });

  socket.on('ice-candidate', (data) => {
    const { to, candidate } = data;
    const targetSocketId = connectedUsers[to];
    
    if (targetSocketId && candidate) {
      io.to(targetSocketId).emit('ice-candidate', {
        candidate
      });
    }
  });

  socket.on('end-call', (data) => {
    const { to, from, reason } = data;
    const targetSocketId = connectedUsers[to];
    
    console.log(`📵 Call ended: ${from} → ${to}${reason ? ` (${reason})` : ''}`);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('end-call', {
        from,
        reason
      });
    }
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Global error handler:', err);
  res.status(err.status || 500).json({
    message: 'Server error',
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});

module.exports = { app, io };
