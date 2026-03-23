import React, { useEffect, useState, useRef } from 'react';
import { chatAPI } from '../utils/api';
import { onReceiveMessage, onDeleteMessage, onDeleteMessageForMe } from '../utils/socket';
import MessageActions from './MessageActions';
import '../styles/ChatWindow.css';

const ChatWindow = ({ currentUser, selectedUser, messages, setMessages, onReply }) => {
  const [loading, setLoading] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages();
    }
  }, [selectedUser]);

  useEffect(() => {
    // Subscribe to incoming messages
    const unsubscribe = onReceiveMessage((message) => {
      console.log('📨 Message received from Socket:', message);
      
      // Update messages if this message is for the current conversation
      // Check both directions: sender→receiver and receiver→sender
      const isForCurrentConversation = 
        (message.sender === currentUser.username && message.receiver === selectedUser.username) ||
        (message.sender === selectedUser.username && message.receiver === currentUser.username);
      
      if (isForCurrentConversation) {
        console.log('✅ Adding message to conversation');
        setMessages((prev) => {
          // Check if message already exists (to avoid duplicates from onMessageSent)
          const isDuplicate = prev.some(
            (m) => m.sender === message.sender && 
                   m.receiver === message.receiver &&
                   m.text === message.text && 
                   Math.abs(new Date(m.timestamp) - new Date(message.timestamp)) < 2000
          );
          
          if (isDuplicate) {
            console.log('⚠️ Duplicate message ignored - already added via callback');
            return prev;
          }
          
          return [...prev, message];
        });
      } else {
        console.log('❌ Message not for current conversation', {
          messageSender: message.sender,
          messageReceiver: message.receiver,
          currentUser: currentUser.username,
          selectedUser: selectedUser.username
        });
      }
    });

    return unsubscribe;
  }, [selectedUser, currentUser.username, setMessages]);

  useEffect(() => {
    // Subscribe to message deletion events (for everyone)
    const unsubscribe = onDeleteMessage((data) => {
      console.log('🗑️ Message deleted:', data.messageId);
      setMessages((prev) => prev.filter((msg) => msg._id !== data.messageId));
    });

    return unsubscribe;
  }, [setMessages]);

  useEffect(() => {
    // Subscribe to message deletion for me only
    const unsubscribe = onDeleteMessageForMe((data) => {
      console.log('🗑️ Message deleted for me:', data.messageId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId && data.username !== currentUser.username
            ? { ...msg, text: '[Deleted message]', deletedForMe: true }
            : msg
        )
      );
    });

    return unsubscribe;
  }, [setMessages, currentUser.username]);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const response = await chatAPI.getMessages(currentUser.username, selectedUser.username);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = (messageId, forMeOnly = false) => {
    if (forMeOnly) {
      // For "delete for me", show as deleted but keep in array
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, text: '[Deleted message]', deletedForMe: true } : msg
        )
      );
    } else {
      // For "delete for everyone", remove completely
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    }
  };

  const handleReplyClick = (message) => {
    if (onReply) {
      onReply({
        id: message._id,
        text: message.text,
        sender: message.sender
      });
    }
  };

  if (!selectedUser) {
    return (
      <div className="chat-window empty">
        <div className="empty-state">
          <h2>Select a user to start chatting</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <h2>{selectedUser.username}</h2>
        <div className={`user-status ${selectedUser.isOnline ? 'online' : 'offline'}`}>
          {selectedUser.isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      <div className="messages-container">
        {loading ? (
          <div className="loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg._id || index}
              className={`message ${msg.sender === currentUser.username ? 'sent' : 'received'} ${
                msg.deletedForMe ? 'deleted' : ''
              }`}
              onMouseEnter={() => setActiveMessageId(msg._id)}
              onMouseLeave={() => setActiveMessageId(null)}
            >
              {msg.replyTo && (
                <div className="message-reply-quote">
                  <div className="reply-quote-sender">↩️ {msg.replyTo.sender}</div>
                  <div className="reply-quote-text">{msg.replyTo.text}</div>
                </div>
              )}
              <div className="message-content">{msg.text}</div>
              <div className="message-time">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>

              {activeMessageId === msg._id && !msg.deletedForMe && (
                <MessageActions
                  messageId={msg._id}
                  message={msg}
                  currentUsername={currentUser.username}
                  isOwnMessage={msg.sender === currentUser.username}
                  onDelete={handleDeleteMessage}
                  onReply={handleReplyClick}
                  onClose={() => setActiveMessageId(null)}
                />
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatWindow;
