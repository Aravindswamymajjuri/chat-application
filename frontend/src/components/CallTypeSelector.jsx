import React from 'react';
import '../styles/CallTypeSelector.css';

const CallTypeSelector = ({ recipientName, onSelectAudio, onSelectVideo, onCancel }) => {
  return (
    <div className="call-type-selector-overlay">
      <div className="call-type-selector-modal">
        <button className="close-btn" onClick={onCancel}>×</button>
        
        <div className="modal-content">
          <h2>Call {recipientName}</h2>
          <p className="modal-subtitle">Choose call type</p>

          <div className="call-type-buttons">
            <button 
              className="call-type-btn audio-call-btn"
              onClick={onSelectAudio}
            >
              <div className="call-type-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 7l-7 5 7 5V7z" fill="currentColor"/>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              </div>
              <div className="call-type-label">Voice Call</div>
              <div className="call-type-desc">Audio only</div>
            </button>

            <button 
              className="call-type-btn video-call-btn"
              onClick={onSelectVideo}
            >
              <div className="call-type-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7" fill="currentColor"/>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              </div>
              <div className="call-type-label">Video Call</div>
              <div className="call-type-desc">Audio + Video</div>
            </button>
          </div>

          <button 
            className="cancel-btn"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallTypeSelector;
