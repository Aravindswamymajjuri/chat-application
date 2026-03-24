import React from 'react';
import '../styles/IncomingCallPopup.css';

const IncomingCallPopup = ({ caller, onAccept, onReject }) => {
  return (
    <div className="incoming-call-popup">
      <div className="popup-content">
        <div className="caller-info">
          <div className="caller-avatar">📱</div>
          <h3>Incoming Call</h3>
          <p className="caller-name">{caller}</p>
        </div>

        <div className="popup-actions">
          <button className="accept-btn" onClick={onAccept} title="Accept Call">
            ✅
          </button>
          <button className="reject-btn" onClick={onReject} title="Reject Call">
            ❌
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallPopup;
