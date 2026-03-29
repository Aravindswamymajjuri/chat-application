import React from 'react';
import '../styles/IncomingCallPopup.css';

const IncomingCallPopup = ({ caller, onAccept, onReject, callType = 'audio' }) => {
  const getInitials = (name) => name ? name.charAt(0).toUpperCase() : '?';
  const isVideoCall = callType === 'video';

  return (
    <div className="incoming-call-popup">
      <div className="popup-content">
        <div className="caller-info">
          <div className="caller-avatar-circle">
            {getInitials(caller)}
          </div>
          <h3>{isVideoCall ? 'Incoming Video Call' : 'Incoming Call'}</h3>
          <p className="caller-name">{caller}</p>
          <p className="call-type-label">{isVideoCall ? 'Video call' : 'Voice call'}</p>
        </div>

        <div className="popup-actions">
          <button className="reject-btn" onClick={onReject} title="Reject Call" aria-label="Reject call">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <button className="accept-btn" onClick={onAccept} title="Accept Call" aria-label="Accept call">
            {isVideoCall ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" fill="currentColor"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallPopup;
