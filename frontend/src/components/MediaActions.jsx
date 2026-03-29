import React, { useRef, useState } from 'react';
import '../styles/MediaActions.css';

const MediaActions = ({ onPhotoSelect, onVideoSelect, onDocumentSelect, isLoading }) => {
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const [showMenu, setShowMenu] = useState(false);

  const handlePhotoClick = () => {
    photoInputRef.current?.click();
  };

  const handleVideoClick = () => {
    videoInputRef.current?.click();
  };

  const handleDocumentClick = () => {
    documentInputRef.current?.click();
  };

  const handleFileSelect = (e, mediaType, callback) => {
    const file = e.target.files?.[0];
    if (file) {
      callback(file, mediaType);
      setShowMenu(false);
    }
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="media-actions-wrapper">
      <div className={`media-menu ${showMenu ? 'open' : ''}`}>
        <button
          type="button"
          className="media-option photo"
          onClick={handlePhotoClick}
          disabled={isLoading}
          title="Send Photo"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
            <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          </svg>
          <span>Photos</span>
        </button>

        <button
          type="button"
          className="media-option video"
          onClick={handleVideoClick}
          disabled={isLoading}
          title="Send Video"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="2" width="20" height="20" rx="2.18" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 12a5 5 0 1 0 10 0 5 5 0 0 0-10 0" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <polygon points="10,9 10,15 15,12" fill="currentColor"/>
          </svg>
          <span>Videos</span>
        </button>

        <button
          type="button"
          className="media-option document"
          onClick={handleDocumentClick}
          disabled={isLoading}
          title="Send Document"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <polyline points="13 2 13 9 20 9" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="9" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="9" y1="19" x2="15" y2="19" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span>Documents</span>
        </button>
      </div>

      <button
        type="button"
        className={`media-toggle ${showMenu ? 'active' : ''}`}
        onClick={() => setShowMenu(!showMenu)}
        disabled={isLoading}
        title="Attach files"
        aria-label="Media menu"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3v6H6v2h6v6h2v-6h6v-2h-6V5h-2z"/>
        </svg>
      </button>

      {/* Hidden file inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={(e) => handleFileSelect(e, 'photo', onPhotoSelect)}
        style={{ display: 'none' }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
        onChange={(e) => handleFileSelect(e, 'video', onVideoSelect)}
        style={{ display: 'none' }}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        onChange={(e) => handleFileSelect(e, 'document', onDocumentSelect)}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default MediaActions;
