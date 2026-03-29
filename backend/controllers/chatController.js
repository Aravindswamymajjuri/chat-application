const Message = require('../models/Message');
const User = require('../models/User');

let io = null;
let connectedUsers = null;

exports.setIO = (socketIO, users) => {
  io = socketIO;
  connectedUsers = users;
};

exports.getMessages = async (req, res) => {
  try {
    const { sender, receiver } = req.query;

    if (!sender || !receiver) {
      return res.status(400).json({ message: 'sender and receiver required' });
    }

    // Find all unseen messages from the other person to mark as seen
    const unseenMessages = await Message.find({
      sender: receiver,
      receiver: sender,
      status: { $in: ['sent', 'delivered'] }
    }).select('_id');

    // Bulk update to 'seen'
    if (unseenMessages.length > 0) {
      await Message.updateMany(
        { _id: { $in: unseenMessages.map(m => m._id) } },
        { $set: { status: 'seen' } }
      );

      // Notify the sender that their messages were seen (per-message status update)
      if (io) {
        const senderSocketId = connectedUsers?.[receiver];
        unseenMessages.forEach(msg => {
          const statusData = {
            messageId: String(msg._id),
            sender: receiver,
            receiver: sender,
            status: 'seen'
          };
          // Emit message-status-updated (what the frontend listens for)
          if (senderSocketId) {
            io.to(senderSocketId).emit('message-status-updated', statusData);
          }
          io.to(`user_${receiver}`).emit('message-status-updated', statusData);
        });
      }
    }

    // Clear unread count: "sender" (current user) is reading messages from "receiver" (other user)
    await User.findOneAndUpdate(
      { username: sender },
      { $unset: { [`unreadCounts.${receiver}`]: 1 } }
    );
    // Notify frontend to clear the badge
    if (io) {
      io.to(`user_${sender}`).emit('unread-count-cleared', { senderUsername: receiver });
    }

    // Get all messages between two users
    const messages = await Message.find({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender }
      ]
    }).sort({ timestamp: 1 });

    const filteredMessages = messages.map(msg => {
      const msgObj = {
        _id: msg._id,
        sender: msg.sender,
        receiver: msg.receiver,
        text: msg.text,
        timestamp: msg.timestamp,
        status: msg.status || 'sent',
        deletedFor: msg.deletedFor || [],
        replyTo: msg.replyTo || null
      };

      if (msg.deletedFor && msg.deletedFor.includes(sender)) {
        msgObj.text = '[Deleted message]';
        msgObj.deletedForMe = true;
      }

      return msgObj;
    });

    res.status(200).json(filteredMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages', error: error.message });
  }
};

exports.saveMessage = async (req, res) => {
  try {
    const { sender, receiver, text, replyTo } = req.body;

    if (!sender || !receiver || !text) {
      return res.status(400).json({ message: 'sender, receiver, and text required' });
    }

    const message = new Message({
      sender,
      receiver,
      text,
      timestamp: new Date(),
      replyTo: replyTo || null
    });

    await message.save();

    // Always increment receiver's unread count for this sender
    const updatedUser = await User.findOneAndUpdate(
      { username: receiver },
      { $inc: { [`unreadCounts.${sender}`]: 1 } },
      { new: true }
    );

    // Notify receiver's frontend of the new unread count via socket
    if (io && updatedUser) {
      // Safely read the count from the Mongoose Map
      const countsObj = updatedUser.unreadCounts
        ? Object.fromEntries(updatedUser.unreadCounts)
        : {};
      const newCount = countsObj[sender] || 1;
      console.log(`📬 Unread count: ${sender} → ${receiver}, count=${newCount}`);
      io.to(`user_${receiver}`).emit('unread-count-updated', {
        senderUsername: sender,
        count: newCount
      });
    }

    const messageObject = message.toObject();
    res.status(201).json({ message: 'Message saved successfully', data: messageObject });
  } catch (error) {
    res.status(500).json({ message: 'Error saving message', error: error.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    if (!messageId) return res.status(400).json({ message: 'messageId required' });

    const result = await Message.findByIdAndDelete(messageId);
    if (!result) return res.status(404).json({ message: 'Message not found' });

    res.status(200).json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting message', error: error.message });
  }
};

exports.deleteMessageForMe = async (req, res) => {
  try {
    const { messageId, username } = req.body;
    if (!messageId || !username) return res.status(400).json({ message: 'messageId and username required' });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (!message.deletedFor.includes(username)) {
      message.deletedFor.push(username);
      await message.save();
    }

    res.status(200).json({ message: 'Message deleted for you', data: message });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting message', error: error.message });
  }
};
