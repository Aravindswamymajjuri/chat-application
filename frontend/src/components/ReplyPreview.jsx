import React from 'react';
import '../styles/ReplyPreview.css';

const ReplyPreview = ({ replyTo, onCancel }) => {
  if (!replyTo) return null;

  return (
    <div className="reply-preview">
      <div className="reply-preview-content">
        <div className="reply-header">
          <span className="reply-label">Replying to {replyTo.sender}</span>
          <button className="reply-cancel" onClick={onCancel} aria-label="Cancel reply">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="reply-text">{replyTo.text}</div>
      </div>
    </div>
  );
};

export default ReplyPreview;
