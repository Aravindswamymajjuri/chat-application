import React from 'react';
import '../styles/CallScreen.css';

const CallScreen = ({ callStatus, remoteUser, onEndCall, remoteAudioRef, isMuted }) => {
  if (!callStatus) return null;

  const getStatusMessage = () => {
    switch (callStatus) {
      case 'calling':
        return `Calling ${remoteUser}...`;
      case 'ringing':
        return `${remoteUser} is ringing...`;
      case 'connected':
        return 'Call Connected';
      case 'ended':
        return 'Call Ended';
      default:
        return '';
    }
  };

  return (
    <div className="call-screen">
      <audio 
        ref={remoteAudioRef} 
        autoPlay 
        playsInline 
        controls={false}
      />
      
      <div className="call-overlay">
        <div className="call-info">
          <div className="call-avatar">📞</div>
          <h2>{remoteUser}</h2>
          <p className={`call-status ${callStatus}`}>{getStatusMessage()}</p>
        </div>

        <div className="call-controls">
          {callStatus !== 'ended' && (
            <>
              <button className="call-control-btn mute-btn" title={isMuted ? 'Unmute' : 'Mute'}>
                🔊
              </button>
              <button className="call-control-btn end-btn" onClick={onEndCall} title="End Call">
                📵
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallScreen;
