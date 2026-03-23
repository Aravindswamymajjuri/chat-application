import React from 'react';
import '../styles/ReplyPreview.css';

const ReplyPreview = ({ replyTo, onCancel }) => {
  if (!replyTo) return null;

  return (
    <div className="reply-preview">
      <div className="reply-preview-content">
        <div className="reply-header">
          <span className="reply-label">Replying to</span>
          <button className="reply-cancel" onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className="reply-quoted">
          <div className="reply-sender">{replyTo.sender}</div>
          <div className="reply-text">{replyTo.text}</div>
        </div>
      </div>
    </div>
  );
};

export default ReplyPreview;
