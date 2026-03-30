import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '../utils/socket';
import { callAPI, chatAPI } from '../utils/api';

const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302'
];

// Metered TURN servers (free tier — reliable for small apps)
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

export const useWebRTCVideo = (currentUser, remoteUser) => {
  const [callStatus, setCallStatus] = useState(null);
  const [incomingCall, setIncomingCall] = useState(false);
  const [incomingCaller, setIncomingCaller] = useState(null);
  const [incomingCallType, setIncomingCallType] = useState('audio');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [networkQuality, setNetworkQuality] = useState('good');
  const [networkWarning, setNetworkWarning] = useState(null);
  const [facingMode, setFacingMode] = useState('user');

  const callRemoteUserRef = useRef(null);
  const callTypeRef = useRef('audio');
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const iceCandidatesRef = useRef([]); // Buffer for early ICE candidates
  const remoteDescSetRef = useRef(false); // Track if remote description is set

  const callStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const networkWarningTimeoutRef = useRef(null);
  const callTimeoutRef = useRef(null);

  const speakerEnabledRef = useRef(speakerEnabled);
  speakerEnabledRef.current = speakerEnabled;

  const isMobile = /iPhone|iPad|Android|webOS/i.test(navigator.userAgent);
  const EARPIECE_VOLUME = isMobile ? 0.6 : 0.3;
  const SPEAKER_VOLUME = 1.0;

  // Attach remote streams to media elements
  const attachRemoteStreams = useCallback(() => {
    const video = remoteVideoRef.current;
    const audio = remoteAudioRef.current;
    const stream = remoteStreamRef.current;
    if (!stream) return;

    if (callTypeRef.current === 'video' && video) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      if (video.paused) video.play().catch(() => {});
    }

    if (audio) {
      if (audio.srcObject !== stream) {
        audio.srcObject = stream;
      }
      audio.muted = false;
      audio.volume = speakerEnabledRef.current ? SPEAKER_VOLUME : EARPIECE_VOLUME;
      if (audio.paused) {
        audio.play().catch(() => {
          // Autoplay blocked — will retry on user interaction
          window.__retryAudioPlay = () => {
            if (audio && remoteStreamRef.current) {
              audio.srcObject = remoteStreamRef.current;
              audio.play().catch(() => {});
            }
          };
        });
      }
    }
  }, [EARPIECE_VOLUME]);

  // Flush buffered ICE candidates after remote description is set
  const flushBufferedCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !remoteDescSetRef.current) return;

    const buffered = iceCandidatesRef.current;
    iceCandidatesRef.current = [];

    for (const candidate of buffered) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        // Ignore — candidate may be stale
      }
    }
    if (buffered.length > 0) {
      console.log(`✅ Flushed ${buffered.length} buffered ICE candidates`);
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const config = {
      iceServers: [
        ...STUN_SERVERS.map(url => ({ urls: url })),
        ...TURN_SERVERS
      ],
      iceCandidatePoolSize: 10
    };

    console.log('🔧 Creating peer connection for', callTypeRef.current, 'call');
    const pc = new RTCPeerConnection(config);

    pc.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        const target = callRemoteUserRef.current || incomingCaller || remoteUser;
        if (target) {
          getSocket().emit('ice-candidate', { to: target, candidate: event.candidate });
        }
      }
    });

    pc.addEventListener('track', (event) => {
      console.log('🎥 Remote track received:', event.track.kind);
      if (event.streams?.[0]) {
        remoteStreamRef.current = event.streams[0];
      } else {
        if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
        remoteStreamRef.current.addTrack(event.track);
      }
      attachRemoteStreams();
      setCallStatus('connected');
    });

    pc.addEventListener('connectionstatechange', () => {
      console.log('🔌 Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        endCall();
      }
    });

    pc.addEventListener('iceconnectionstatechange', () => {
      console.log('🧊 ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.error('❌ ICE connection failed — network issue');
        endCall();
      }
    });

    peerConnectionRef.current = pc;
    return pc;
  }, [remoteUser, incomingCaller, attachRemoteStreams]);

  // Get local media stream
  const getLocalStream = useCallback(async (type) => {
    if (localStreamRef.current) return localStreamRef.current;

    const useType = type || callTypeRef.current;
    const constraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: useType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false
    };

    console.log(`📱 Requesting ${useType} media...`);
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log(`✅ Got stream with ${stream.getTracks().length} tracks`);

    localStreamRef.current = stream;

    if (useType === 'video' && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }

    const pc = createPeerConnection();
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    return stream;
  }, [createPeerConnection]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTracks = localStreamRef.current.getVideoTracks();
    if (videoTracks.length === 0) return;
    const shouldEnable = !isVideoEnabled;
    videoTracks.forEach(track => { track.enabled = shouldEnable; });
    setIsVideoEnabled(shouldEnable);
  }, [isVideoEnabled]);

  // Flip camera (front/back)
  const flipCamera = useCallback(async () => {
    if (!localStreamRef.current || callTypeRef.current !== 'video') return;
    const newMode = facingMode === 'user' ? 'environment' : 'user';

    try {
      // Stop old video tracks
      localStreamRef.current.getVideoTracks().forEach(t => t.stop());

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: newMode }
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace the track in the peer connection
      const pc = peerConnectionRef.current;
      if (pc) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(newVideoTrack);
      }

      // Replace in local stream
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldVideoTrack) localStreamRef.current.removeTrack(oldVideoTrack);
      localStreamRef.current.addTrack(newVideoTrack);

      // Update local video preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      setFacingMode(newMode);
    } catch (err) {
      console.error('❌ Failed to flip camera:', err);
    }
  }, [facingMode]);

  // Start call (caller side)
  const startCall = useCallback(async (type = 'audio') => {
    try {
      console.log(`📞 Starting ${type} call to ${remoteUser}...`);
      if (!remoteUser) return;

      callRemoteUserRef.current = remoteUser;
      callTypeRef.current = type;
      remoteDescSetRef.current = false;
      iceCandidatesRef.current = [];
      setSpeakerEnabled(false);
      setIsMuted(false);
      // Set these BEFORE getLocalStream so VideoCallScreen mounts and refs are ready
      setIsVideoEnabled(type === 'video');
      setCallStatus('calling');

      await getLocalStream(type);
      const pc = createPeerConnection();

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === 'video'
      });
      await pc.setLocalDescription(offer);

      getSocket().emit('call-user', {
        to: remoteUser,
        from: currentUser,
        offer,
        callType: type
      });

      // 60s timeout for unanswered calls
      callTimeoutRef.current = setTimeout(() => {
        if (!remoteDescSetRef.current) {
          console.log('⏰ Call timeout — no answer');
          endCall();
        }
      }, 60000);

    } catch (error) {
      console.error('❌ Error starting call:', error);
      setCallStatus('ended');
    }
  }, [remoteUser, currentUser, getLocalStream, createPeerConnection]);

  // Handle incoming offer (receiver side) — DON'T request media yet, just show popup
  const handleOffer = useCallback(async (offer, from, type = 'audio') => {
    try {
      console.log(`📨 Incoming ${type} call from ${from}`);
      callRemoteUserRef.current = from;
      callTypeRef.current = type;
      remoteDescSetRef.current = false;
      iceCandidatesRef.current = [];
      setIncomingCallType(type);
      setIncomingCall(true);
      setIncomingCaller(from);
      setCallStatus('ringing');

      // Create peer connection and set remote description (no media yet)
      const pc = createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      remoteDescSetRef.current = true;

      // Flush any ICE candidates that arrived before remote desc was set
      await flushBufferedCandidates();

    } catch (error) {
      console.error('❌ Error handling offer:', error);
      setCallStatus(null);
    }
  }, [createPeerConnection, flushBufferedCandidates]);

  // Accept call — NOW request media and send answer
  const acceptCall = useCallback(async () => {
    try {
      setIncomingCall(false);
      setSpeakerEnabled(false);
      setIsMuted(false);
      // Set video enabled BEFORE getting stream so the <video> element mounts in time
      setIsVideoEnabled(callTypeRef.current === 'video');
      setCallStatus('connected');

      const pc = peerConnectionRef.current;
      if (!pc) { console.error('❌ No peer connection'); return; }

      // Request media AFTER user accepts (avoids permission prompt before seeing who's calling)
      await getLocalStream(callTypeRef.current);

      const answer = await pc.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callTypeRef.current === 'video'
      });
      await pc.setLocalDescription(answer);

      callStartTimeRef.current = Date.now();
      setCallDuration(0);
      timerIntervalRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
      }, 1000);
      statsIntervalRef.current = setInterval(monitorNetworkQuality, 2000);

      getSocket().emit('answer-call', {
        to: incomingCaller,
        from: currentUser,
        answer,
        callType: callTypeRef.current
      });

      console.log('✅ Call accepted, answer sent');
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      setCallStatus('ended');
    }
  }, [getLocalStream, incomingCaller, currentUser]);

  // Handle answer (caller receives)
  const handleAnswer = useCallback(async (answer) => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      remoteDescSetRef.current = true;

      // Flush buffered ICE candidates
      await flushBufferedCandidates();

      // Start timer
      if (!callStartTimeRef.current) {
        callStartTimeRef.current = Date.now();
        setCallDuration(0);
        timerIntervalRef.current = setInterval(() => {
          setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
        }, 1000);
        statsIntervalRef.current = setInterval(monitorNetworkQuality, 2000);
      }

      console.log('✅ Remote description set from answer');
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  }, [flushBufferedCandidates]);

  // Handle ICE candidate — buffer if remote description not set yet
  const handleIceCandidate = useCallback(async (candidate) => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc || !candidate) return;

      if (!remoteDescSetRef.current) {
        // Buffer — remote description not set yet
        iceCandidatesRef.current.push(candidate);
        return;
      }

      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      if (error.code !== 11) {
        console.error('❌ ICE candidate error:', error);
      }
    }
  }, []);

  // Monitor network quality
  const monitorNetworkQuality = useCallback(() => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    pc.getStats().then((stats) => {
      let quality = 'excellent';
      let warning = null;

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          const total = (report.packetsLost || 0) + (report.packetsReceived || 0);
          const lossPct = total > 0 ? (report.packetsLost / total) * 100 : 0;
          if (lossPct > 5) { quality = 'poor'; warning = 'Poor network'; }
          else if (lossPct > 2) quality = 'fair';
          else if (lossPct > 1) quality = 'good';
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const rtt = report.currentRoundTripTime;
          if (rtt > 0.4) { quality = 'poor'; warning = 'High latency'; }
          else if (rtt > 0.2 && quality !== 'poor') quality = 'fair';
        }
      });

      setNetworkQuality(quality);
      if (warning && !networkWarning) {
        setNetworkWarning(warning);
        clearTimeout(networkWarningTimeoutRef.current);
        networkWarningTimeoutRef.current = setTimeout(() => setNetworkWarning(null), 5000);
      }
    });
  }, [networkWarning]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    if (networkWarningTimeoutRef.current) clearTimeout(networkWarningTimeoutRef.current);

    callStartTimeRef.current = null;
    callRemoteUserRef.current = null;
    remoteStreamRef.current = null;
    remoteDescSetRef.current = false;
    iceCandidatesRef.current = [];

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }, []);

  // Save call record + call event message in chat
  const saveCallRecord = useCallback((target, duration, status) => {
    const type = callTypeRef.current || 'audio';
    callAPI.saveCall(currentUser, target, duration, status).catch(() => {});
    chatAPI.saveCallEvent(currentUser, target, type, duration, status).catch(() => {});
  }, [currentUser]);

  // Reject call
  const rejectCall = useCallback(() => {
    const caller = incomingCaller;
    setIncomingCall(false);
    setIncomingCaller(null);
    setCallStatus(null);
    getSocket().emit('end-call', { to: caller, from: currentUser, reason: 'rejected' });
    cleanup();
    // Save as rejected call
    if (caller) saveCallRecord(caller, 0, 'rejected');
  }, [incomingCaller, currentUser, cleanup, saveCallRecord]);

  // End call
  const endCall = useCallback(() => {
    const duration = callStartTimeRef.current ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) : 0;
    const target = callRemoteUserRef.current || incomingCaller || remoteUser;
    setCallStatus('ended');
    setIncomingCall(false);
    getSocket().emit('end-call', { to: target, from: currentUser });
    cleanup();
    // Save call record
    if (target) saveCallRecord(target, duration, duration > 0 ? 'completed' : 'missed');
    setTimeout(() => { setCallStatus(null); setCallDuration(0); setNetworkWarning(null); }, 1000);
  }, [remoteUser, incomingCaller, currentUser, cleanup, saveCallRecord]);

  // Handle remote end call
  const handleRemoteEndCall = useCallback(() => {
    const duration = callStartTimeRef.current ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) : 0;
    const target = callRemoteUserRef.current || incomingCaller || remoteUser;
    setCallStatus('ended');
    setIncomingCall(false);
    cleanup();
    // Don't save from receiver side — caller already saved it
    setTimeout(() => { setCallStatus(null); setCallDuration(0); setNetworkWarning(null); }, 1000);
  }, [cleanup, remoteUser, incomingCaller]);

  // Mute/unmute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsMuted(prev => !prev);
    }
  }, []);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    setSpeakerEnabled(prev => {
      const next = !prev;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.volume = next ? SPEAKER_VOLUME : EARPIECE_VOLUME;
      }
      return next;
    });
  }, [EARPIECE_VOLUME]);

  // Re-attach streams when video elements mount (fixes timing issue where
  // getLocalStream / track event fires before the <video> elements are in the DOM)
  useEffect(() => {
    // Attach local video preview when the element becomes available
    if (isVideoEnabled && localStreamRef.current && localVideoRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
        console.log('🎥 Local video re-attached after mount');
      }
    }

    // Attach remote video/audio when elements become available
    if (callStatus && remoteStreamRef.current) {
      attachRemoteStreams();
    }
  }, [callStatus, isVideoEnabled, attachRemoteStreams]);

  return {
    callStatus, incomingCall, incomingCaller, incomingCallType,
    callDuration, isMuted, speakerEnabled, isVideoEnabled,
    networkQuality, networkWarning,
    callType: incomingCall ? incomingCallType : callTypeRef.current,
    remoteAudioRef, remoteVideoRef, localVideoRef,
    startCall, acceptCall, rejectCall, endCall,
    handleOffer, handleAnswer, handleIceCandidate, handleRemoteEndCall,
    toggleMute, toggleSpeaker, toggleVideo, flipCamera, facingMode, cleanup
  };
};

export default useWebRTCVideo;
