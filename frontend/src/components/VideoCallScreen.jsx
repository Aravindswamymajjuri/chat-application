import React, { useEffect, useState } from 'react';
import '../styles/VideoCallScreen.css';

const VideoCallScreen = ({
  callStatus,
  remoteUser,
  onEndCall,
  remoteAudioRef,
  remoteVideoRef,
  localVideoRef,
  isMuted,
  callDuration,
  networkQuality,
  networkWarning,
  isVideoEnabled,
  onToggleMute,
  onToggleSpeaker,
  onToggleVideo,
  onFlipCamera,
  facingMode,
  speakerEnabled
}) => {
  const [formattedTime, setFormattedTime] = useState('00:00');

  useEffect(() => {
    const minutes = Math.floor(callDuration / 60);
    const seconds = callDuration % 60;
    setFormattedTime(
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    );
  }, [callDuration]);

  if (!callStatus) return null;

  const getStatusMessage = () => {
    switch (callStatus) {
      case 'calling': return `Calling ${remoteUser}...`;
      case 'ringing': return `${remoteUser} is ringing...`;
      case 'connected': return 'Call Connected';
      case 'ended': return 'Call Ended';
      default: return '';
    }
  };

  const getInitials = (name) => name ? name.charAt(0).toUpperCase() : '?';

  const getNetworkIcon = () => {
    const bars = networkQuality === 'excellent' ? 4 : networkQuality === 'good' ? 3 : networkQuality === 'fair' ? 2 : 1;
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <rect x="2" y="18" width="4" height="4" opacity={bars >= 1 ? 1 : 0.3} rx="1"/>
        <rect x="8" y="13" width="4" height="9" opacity={bars >= 2 ? 1 : 0.3} rx="1"/>
        <rect x="14" y="8" width="4" height="14" opacity={bars >= 3 ? 1 : 0.3} rx="1"/>
        <rect x="20" y="3" width="4" height="19" opacity={bars >= 4 ? 1 : 0.3} rx="1"/>
      </svg>
    );
  };

  return (
    <div className="video-call-screen">
      {/* Audio element for receiving audio */}
      <audio
        ref={remoteAudioRef}
        autoPlay={true}
        playsInline
        controls={false}
      />

      {/* Remote video */}
      <div className="remote-video-container">
        <video
          ref={remoteVideoRef}
          className="remote-video"
          autoPlay={true}
          playsInline
          muted={false}
        />

        {/* Network warning */}
        {networkWarning && (
          <div className="network-warning">{networkWarning}</div>
        )}

        {/* Call info overlay */}
        <div className="call-info-overlay">
          <div className="call-header">
            <div className={`call-avatar ${callStatus === 'ringing' || callStatus === 'calling' ? 'ringing' : ''}`}>
              {getInitials(remoteUser)}
            </div>
            <div className="call-header-info">
              <h2>{remoteUser}</h2>
              <p className={`call-status ${callStatus}`}>{getStatusMessage()}</p>
            </div>
          </div>

          {callStatus === 'connected' && (
            <div className="call-stats">
              <span className="call-duration">{formattedTime}</span>
              <span className="network-quality" title={`Network: ${networkQuality}`}>
                {getNetworkIcon()} {networkQuality}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Local video (small preview) */}
      {isVideoEnabled && (
        <div className="local-video-container">
          <video
            ref={localVideoRef}
            className={`local-video ${facingMode === 'environment' ? 'no-mirror' : ''}`}
            autoPlay={true}
            playsInline
            muted={true}
          />
        </div>
      )}

      {/* Controls */}
      <div className="video-call-controls">
        {/* Mute button */}
        <button
          className={`control-btn ${isMuted ? 'active' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5v6M1 5v6c0 4.4 3.6 8 8 8h4M1 1l22 22"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v12a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          )}
        </button>

        {/* Video toggle button */}
        <button
          className={`control-btn ${isVideoEnabled ? '' : 'active'}`}
          onClick={onToggleVideo}
          title={isVideoEnabled ? 'Turn off video' : 'Turn on video'}
          aria-label={isVideoEnabled ? 'Turn off video' : 'Turn on video'}
        >
          {isVideoEnabled ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5v6m0 0l-7-5M16 12l7-5V7m0 0H1m15 14H1V5m15 14L1 1M1 19l22-22"/>
            </svg>
          )}
        </button>

        {/* Speaker toggle button */}
        <button
          className={`control-btn ${speakerEnabled ? 'active' : ''}`}
          onClick={onToggleSpeaker}
          title={speakerEnabled ? 'Earpiece mode' : 'Speaker mode'}
          aria-label={speakerEnabled ? 'Switch to earpiece' : 'Switch to speaker'}
        >
          {speakerEnabled ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M23 9v6"/>
            </svg>
          )}
        </button>

        {/* Flip camera button (only on mobile with video enabled) */}
        {isVideoEnabled && (
          <button
            className="control-btn flip-btn"
            onClick={onFlipCamera}
            title={facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
            aria-label={facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4"/>
              <path d="M4 8V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/>
              <polyline points="16 12 12 8 8 12"/>
              <polyline points="8 12 12 16 16 12"/>
            </svg>
          </button>
        )}

        {/* End call button */}
        <button
          className="control-btn end-btn"
          onClick={onEndCall}
          title="End call"
          aria-label="End call"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="23" y1="1" x2="1" y2="23"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default VideoCallScreen;
