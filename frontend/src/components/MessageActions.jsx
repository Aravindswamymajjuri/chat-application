import React, { useState } from 'react';
import { chatAPI } from '../utils/api';
import { emitDeleteMessage, emitDeleteMessageForMe } from '../utils/socket';
import '../styles/MessageActions.css';

const MessageActions = ({
  messageId,
  message,
  currentUsername,
  isOwnMessage,
  onDelete,
  onReply,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      await chatAPI.deleteMessage(messageId);
      // Broadcast to all connected users via Socket.IO
      emitDeleteMessage(messageId);
      onDelete(messageId);
      onClose();
    } catch (err) {
      setError('Failed to delete message');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteForMe = async () => {
    setLoading(true);
    setError('');
    try {
      await chatAPI.deleteMessageForMe(messageId, currentUsername);
      // Broadcast delete for me event via Socket.IO
      emitDeleteMessageForMe(messageId, currentUsername);
      onDelete(messageId, true);
      onClose();
    } catch (err) {
      setError('Failed to delete message');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = () => {
    onReply(message);
    onClose();
  };

  return (
    <div className="message-actions">
      <button
        className="action-btn reply-btn"
        onClick={handleReply}
        disabled={loading}
        title="Reply to this message"
      >
        💬 Reply
      </button>

      <button
        className="action-btn delete-for-me-btn"
        onClick={handleDeleteForMe}
        disabled={loading}
        title="Delete for you only"
      >
        🗑️ Delete for me
      </button>

      {isOwnMessage && (
        <button
          className="action-btn delete-all-btn"
          onClick={handleDelete}
          disabled={loading}
          title="Delete for everyone"
        >
          ❌ Delete msg
        </button>
      )}

      {error && <div className="action-error">{error}</div>}
    </div>
  );
};

export default MessageActions;
