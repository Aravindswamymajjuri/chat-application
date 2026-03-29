import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '../utils/socket';
import { callAPI } from '../utils/api';

const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
  'stun:stunserver.org:3478'
];

const TURN_SERVERS = [
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

export const useWebRTCVideo = (currentUser, remoteUser, callType = 'audio') => {
  // Call states
  const [callStatus, setCallStatus] = useState(null); // null, 'calling', 'ringing', 'connected', 'ended'
  const [incomingCall, setIncomingCall] = useState(false);
  const [incomingCaller, setIncomingCaller] = useState(null);
  const [incomingCallType, setIncomingCallType] = useState('audio'); // 'audio' or 'video'
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [networkQuality, setNetworkQuality] = useState('good');
  const [networkWarning, setNetworkWarning] = useState(null);

  // Refs for call management
  const callRemoteUserRef = useRef(null);
  const callTypeRef = useRef(callType); // Track which type of call we're in
  
  // Peer connection refs
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const iceCandidatesRef = useRef([]);
  
  // Timer and stats refs
  const callStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const networkWarningTimeoutRef = useRef(null);
  const hasAttachedStreamsRef = useRef(false);

  const speakerEnabledRef = useRef(speakerEnabled);
  speakerEnabledRef.current = speakerEnabled;

  // Detect mobile
  const isMobile = /iPhone|iPad|Android|webOS/i.test(navigator.userAgent);
  const EARPIECE_VOLUME = isMobile ? 0.6 : 0.3;
  const SPEAKER_VOLUME = 1.0;

  // Attach remote streams to elements
  const attachRemoteStreams = useCallback(() => {
    const video = remoteVideoRef.current;
    const audio = remoteAudioRef.current;
    const stream = remoteStreamRef.current;

    if (!stream) return;

    console.log('🎬 Attaching remote streams...');

    // Attach video if video call
    if (video && callTypeRef.current === 'video') {
      if (video.srcObject !== stream) {
        console.log('📹 Attaching remote video stream');
        video.srcObject = stream;
      }

      if (video.paused) {
        video.play().catch(err => console.error('Video play error:', err));
      }
    }

    // For video calls, audio comes from video element
    // For audio calls, attach to audio element
    if (callTypeRef.current === 'audio' && audio) {
      if (audio.srcObject !== stream) {
        console.log('🔊 Attaching remote audio stream');
        audio.srcObject = stream;
      }

      audio.muted = false;
      audio.volume = speakerEnabledRef.current ? SPEAKER_VOLUME : EARPIECE_VOLUME;

      if (audio.paused) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => console.log('✅ Remote audio playing'))
            .catch(err => {
              console.error('❌ Audio play error:', err);
              window.__retryAudioPlay = () => {
                if (audio && audio.paused && remoteStreamRef.current) {
                  audio.srcObject = remoteStreamRef.current;
                  audio.play().catch(e => console.error('Still failed:', e));
                }
              };
            });
        }
      }
    }
  }, [EARPIECE_VOLUME]);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const iceServers = [
      ...STUN_SERVERS.map(url => ({ urls: url })),
      ...TURN_SERVERS
    ];

    const config = {
      iceServers: iceServers,
      iceCandidatePoolSize: 10
    };

    console.log('🔧 Creating peer connection for', callTypeRef.current, 'call');

    const peerConnection = new RTCPeerConnection(config);

    // ICE candidates
    peerConnection.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        const target = callRemoteUserRef.current || incomingCaller || remoteUser;
        if (target) {
          getSocket().emit('ice-candidate', {
            to: target,
            candidate: event.candidate
          });
        }
      }
    });

    // Remote tracks
    peerConnection.addEventListener('track', (event) => {
      console.log('🎥 Remote track received:', event.track.kind);
      
      if (event.streams && event.streams.length > 0) {
        remoteStreamRef.current = event.streams[0];
      } else {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        remoteStreamRef.current.addTrack(event.track);
      }

      attachRemoteStreams();

      if (!callStatus || callStatus !== 'connected') {
        setCallStatus('connected');
      }
    });

    // Connection state
    peerConnection.addEventListener('connectionstatechange', () => {
      console.log('🔌 Connection state:', peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'failed' ||
          peerConnection.connectionState === 'disconnected' ||
          peerConnection.connectionState === 'closed') {
        endCall();
      }
    });

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }, [remoteUser, incomingCaller, callStatus]);

  // Get local streams
  const getLocalStream = useCallback(async () => {
    try {
      if (localStreamRef.current) return localStreamRef.current;

      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: callTypeRef.current === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };

      console.log(`📱 Requesting media for ${callTypeRef.current} call...`);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      console.log(`✅ Got ${callTypeRef.current} stream with ${stream.getTracks().length} tracks`);

      localStreamRef.current = stream;

      // Attach local video to ref if video call
      if (callTypeRef.current === 'video' && localVideoRef.current) {
        console.log('📹 Attaching local video stream');
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(err => console.error('Local video play error:', err));
      }

      // Add tracks to peer connection
      const peerConnection = createPeerConnection();
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
        console.log(`✅ Added ${track.kind} to peer connection`);
      });

      return stream;
    } catch (error) {
      console.error('❌ Error getting media:', error);
      setCallStatus('ended');
      throw error;
    }
  }, [createPeerConnection]);

  // Toggle video during call
  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;

    const videoTracks = localStreamRef.current.getVideoTracks();
    if (videoTracks.length === 0) return;

    const shouldEnable = !isVideoEnabled;
    videoTracks.forEach(track => {
      track.enabled = shouldEnable;
    });

    setIsVideoEnabled(shouldEnable);
    console.log(`📹 Video ${shouldEnable ? 'enabled' : 'disabled'}`);
  }, [isVideoEnabled]);

  // Create offer
  const createOffer = useCallback(async () => {
    try {
      console.log('📋 Creating offer...');
      await getLocalStream();
      const peerConnection = createPeerConnection();

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callTypeRef.current === 'video'
      });

      await peerConnection.setLocalDescription(offer);

      console.log('✅ Offer created');
      setCallStatus('calling');

      return offer;
    } catch (error) {
      console.error('❌ Error creating offer:', error);
      setCallStatus('ended');
      throw error;
    }
  }, [getLocalStream, createPeerConnection]);

  // Create answer
  const createAnswer = useCallback(async () => {
    try {
      console.log('📋 Creating answer...');
      await getLocalStream();

      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) throw new Error('No peer connection');

      const answer = await peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callTypeRef.current === 'video'
      });

      await peerConnection.setLocalDescription(answer);

      console.log('✅ Answer created');
      return answer;
    } catch (error) {
      console.error('❌ Error creating answer:', error);
      setCallStatus('ended');
      throw error;
    }
  }, [getLocalStream]);

  // Handle offer
  const handleOffer = useCallback(async (offer, from, type = 'audio') => {
    try {
      console.log(`📨 Offer received from ${from} (${type} call)`);
      callRemoteUserRef.current = from;
      callTypeRef.current = type;
      setIncomingCallType(type);

      await getLocalStream();
      const peerConnection = createPeerConnection();

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      setIncomingCall(true);
      setIncomingCaller(from);
      setCallStatus('ringing');
    } catch (error) {
      console.error('❌ Error handling offer:', error);
    }
  }, [getLocalStream, createPeerConnection]);

  // Handle answer
  const handleAnswer = useCallback(async (answer) => {
    try {
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) return;

      console.log('📩 Answer received');
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

      // Start timer when answer is received
      if (callStartTimeRef.current === null) {
        callStartTimeRef.current = Date.now();
        setCallDuration(0);

        timerIntervalRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
          setCallDuration(elapsed);
        }, 1000);

        statsIntervalRef.current = setInterval(monitorNetworkQuality, 2000);
      }
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (candidate) => {
    try {
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection || !candidate) return;

      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added');
    } catch (error) {
      if (error.code !== 11) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    }
  }, []);

  // Monitor network quality
  const monitorNetworkQuality = useCallback(() => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection) return;

    peerConnection.getStats().then((stats) => {
      let quality = 'excellent';
      let warning = null;

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          const packetLossPercent = report.packetsReceived > 0 
            ? (report.packetsLost / (report.packetsLost + report.packetsReceived)) * 100
            : 0;

          if (packetLossPercent > 5) {
            quality = 'poor';
            warning = '⚠️ Poor network - call may be affected';
          } else if (packetLossPercent > 2) {
            quality = 'fair';
          } else if (packetLossPercent > 1) {
            quality = 'good';
          }
        }
      });

      setNetworkQuality(quality);

      if (warning && !networkWarning) {
        setNetworkWarning(warning);
        clearTimeout(networkWarningTimeoutRef.current);
        networkWarningTimeoutRef.current = setTimeout(() => {
          setNetworkWarning(null);
        }, 5000);
      }
    });
  }, [networkWarning]);

  // Cleanup
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up...');

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    if (networkWarningTimeoutRef.current) clearTimeout(networkWarningTimeoutRef.current);

    callStartTimeRef.current = null;
    callRemoteUserRef.current = null;
    remoteStreamRef.current = null;
    hasAttachedStreamsRef.current = false;

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    console.log('✅ Cleanup complete');
  }, []);

  // Start call
  const startCall = useCallback(async (type = 'audio') => {
    try {
      console.log(`📞 Starting ${type} call to ${remoteUser}...`);
      callRemoteUserRef.current = remoteUser;
      callTypeRef.current = type;
      setIsVideoEnabled(type === 'video');

      if (!remoteUser) {
        console.error('❌ No remote user');
        return;
      }

      const offer = await createOffer();

      getSocket().emit('call-user', {
        to: remoteUser,
        from: currentUser,
        offer,
        callType: type
      });

      console.log('📤 Call emitted');
    } catch (error) {
      console.error('❌ Error starting call:', error);
      setCallStatus('ended');
    }
  }, [remoteUser, currentUser, createOffer]);

  // Accept call
  const acceptCall = useCallback(async () => {
    try {
      setIncomingCall(false);

      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) {
        console.error('❌ No peer connection');
        return;
      }

      const answer = await createAnswer();

      setCallStatus('connected');

      // Start timer
      callStartTimeRef.current = Date.now();
      setCallDuration(0);
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        setCallDuration(elapsed);
      }, 1000);

      statsIntervalRef.current = setInterval(monitorNetworkQuality, 2000);

      getSocket().emit('answer-call', {
        to: incomingCaller,
        from: currentUser,
        answer,
        callType: callTypeRef.current
      });

      console.log('📤 Answer sent');
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      setCallStatus('ended');
    }
  }, [createAnswer, incomingCaller, currentUser]);

  // Reject call
  const rejectCall = useCallback(() => {
    setIncomingCall(false);
    setIncomingCaller(null);
    setCallStatus(null);

    getSocket().emit('end-call', {
      to: incomingCaller,
      from: currentUser,
      reason: 'rejected'
    });

    cleanup();
  }, [incomingCaller, currentUser, cleanup]);

  // End call
  const endCall = useCallback(() => {
    setCallStatus('ended');
    setIncomingCall(false);

    const target = callRemoteUserRef.current || incomingCaller || remoteUser;
    getSocket().emit('end-call', {
      to: target,
      from: currentUser
    });

    cleanup();

    setTimeout(() => {
      setCallStatus(null);
      setCallDuration(0);
      setNetworkWarning(null);
      setIsVideoEnabled(callType === 'video');
    }, 1000);
  }, [remoteUser, incomingCaller, currentUser, cleanup, callType]);

  // Handle remote end call
  const handleRemoteEndCall = useCallback(() => {
    setCallStatus('ended');
    setIncomingCall(false);
    cleanup();

    setTimeout(() => {
      setCallStatus(null);
      setCallDuration(0);
      setNetworkWarning(null);
    }, 1000);
  }, [cleanup]);

  // Mute/unmute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    setSpeakerEnabled(!speakerEnabled);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = !speakerEnabled ? SPEAKER_VOLUME : EARPIECE_VOLUME;
    }
  }, [speakerEnabled, EARPIECE_VOLUME]);

  return {
    // State
    callStatus,
    incomingCall,
    incomingCaller,
    incomingCallType,
    callDuration,
    isMuted,
    speakerEnabled,
    isVideoEnabled,
    networkQuality,
    networkWarning,
    callType: incomingCall ? incomingCallType : callTypeRef.current,

    // Refs
    remoteAudioRef,
    remoteVideoRef,
    localVideoRef,

    // Methods
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleRemoteEndCall,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    cleanup
  };
};

export default useWebRTCVideo;
