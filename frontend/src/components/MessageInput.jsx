import React, { useState, useEffect } from 'react';
import { chatAPI, notificationAPI } from '../utils/api';
import { emitSendMessage, emitTyping, emitStopTyping } from '../utils/socket';
import ReplyPreview from './ReplyPreview';
import '../styles/MessageInput.css';

const MessageInput = ({ currentUser, selectedUser, onMessageSent, replyingTo, onReplyCancel }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = React.useRef(null);

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      emitTyping(currentUser.username, selectedUser.username);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      emitStopTyping(currentUser.username, selectedUser.username);
    }, 2000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!text.trim()) return;

    setLoading(true);
    const messageText = text.trim();
    const replyData = replyingTo ? {
      messageId: replyingTo.id,
      text: replyingTo.text,
      sender: replyingTo.sender
    } : null;

    setText('');
    setIsTyping(false);
    onReplyCancel?.();

    try {
      // Save message to database
      const saveResponse = await chatAPI.saveMessage(currentUser.username, selectedUser.username, messageText, replyData);
      const savedMessage = saveResponse.data?.data; // Get the saved message with _id and replyTo
      
      console.log('💾 Saved message from API:', savedMessage);
      console.log('📦 replyData that was sent:', replyData);

      // Emit via Socket.IO for real-time delivery with the full saved message (includes _id)
      emitSendMessage(currentUser.username, selectedUser.username, messageText, replyData, savedMessage);

      // Send push notification
      try {
        await notificationAPI.sendNotificationByUsername(
          selectedUser.username,
          currentUser.username,
          messageText
        );
      } catch (notifError) {
        console.warn('Notification failed (but message was sent):', notifError.message);
      }

      // Callback to update UI with the saved message data (includes _id and properly formatted replyTo)
      if (onMessageSent) {
        console.log('🚀 Calling onMessageSent with:', savedMessage || 'fallback object');
        onMessageSent(savedMessage || {
          sender: currentUser.username,
          receiver: selectedUser.username,
          text: messageText,
          replyTo: replyData,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setText(messageText); // Restore text on error
      alert('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="message-input-wrapper">
      {replyingTo && (
        <ReplyPreview
          replyTo={replyingTo}
          onCancel={onReplyCancel}
        />
      )}
      <form className="message-input" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleTyping();
          }}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !text.trim()}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
