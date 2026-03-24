import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '../utils/socket';

const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302'
];

export const useWebRTC = (currentUser, remoteUser) => {
  const [callStatus, setCallStatus] = useState(null); // null, 'calling', 'ringing', 'connected', 'ended'
  const [incomingCall, setIncomingCall] = useState(false);
  const [incomingCaller, setIncomingCaller] = useState(null);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const iceCandidatesRef = useRef([]);

  // Initialize RTCPeerConnection
  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const config = {
      iceServers: STUN_SERVERS.map(url => ({ urls: url }))
    };

    const peerConnection = new RTCPeerConnection(config);

    // Handle ICE candidates
    peerConnection.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        console.log('📡 ICE Candidate:', event.candidate);
        getSocket().emit('ice-candidate', {
          to: remoteUser,
          candidate: event.candidate
        });
      }
    });

    // Handle remote stream
    peerConnection.addEventListener('track', (event) => {
      console.log('🎵 Remote audio track received:', event.track);
      if (remoteAudioRef.current) {
        // Create new MediaStream with all tracks
        if (!remoteAudioRef.current.srcObject) {
          remoteAudioRef.current.srcObject = new MediaStream();
        }
        const remoteStream = remoteAudioRef.current.srcObject;
        remoteStream.addTrack(event.track);
        
        // Ensure audio element is ready to play
        remoteAudioRef.current.play().catch(err => {
          console.error('❌ Error playing audio:', err);
        });
      }
    });

    // Handle connection state changes
    peerConnection.addEventListener('connectionstatechange', () => {
      console.log('🔌 Connection state:', peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'connected') {
        setCallStatus('connected');
      } else if (
        peerConnection.connectionState === 'disconnected' ||
        peerConnection.connectionState === 'failed' ||
        peerConnection.connectionState === 'closed'
      ) {
        endCall();
      }
    });

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }, [remoteUser]);

  // Get local audio stream
  const getLocalStream = useCallback(async () => {
    try {
      if (localStreamRef.current) return localStreamRef.current;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      console.log('🎤 Local audio stream obtained');
      localStreamRef.current = stream;

      // Add local audio tracks to peer connection
      const peerConnection = createPeerConnection();
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      return stream;
    } catch (error) {
      console.error('❌ Error getting local stream:', error);
      setCallStatus('ended');
      throw error;
    }
  }, [createPeerConnection]);

  // Create offer (initiator)
  const createOffer = useCallback(async () => {
    try {
      await getLocalStream();
      const peerConnection = createPeerConnection();

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });

      await peerConnection.setLocalDescription(offer);

      console.log('📤 Offer created:', offer);
      setCallStatus('calling');

      return offer;
    } catch (error) {
      console.error('❌ Error creating offer:', error);
      setCallStatus('ended');
      throw error;
    }
  }, [getLocalStream, createPeerConnection]);

  // Create answer (receiver)
  const createAnswer = useCallback(async () => {
    try {
      await getLocalStream();
      // Use existing peer connection that already has remote description set
      const peerConnection = peerConnectionRef.current;
      
      if (!peerConnection) {
        console.error('❌ No peer connection available for answer');
        throw new Error('Peer connection not initialized');
      }

      // Remote description should already be set in handleOffer
      // Just create and set the answer
      const answer = await peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });

      await peerConnection.setLocalDescription(answer);

      console.log('📥 Answer created:', answer);

      return answer;
    } catch (error) {
      console.error('❌ Error creating answer:', error);
      setCallStatus('ended');
      throw error;
    }
  }, [getLocalStream]);

  // Handle incoming offer
  const handleOffer = useCallback(async (offer, from) => {
    try {
      await getLocalStream();
      const peerConnection = createPeerConnection();

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      console.log('📨 Offer received from', from);
      setIncomingCall(true);
      setIncomingCaller(from);
      setCallStatus('ringing');
    } catch (error) {
      console.error('❌ Error handling offer:', error);
    }
  }, [getLocalStream, createPeerConnection]);

  // Handle incoming answer
  const handleAnswer = useCallback(async (answer) => {
    try {
      const peerConnection = peerConnectionRef.current;
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('📩 Answer received:', answer);
      }
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (candidate) => {
    try {
      const peerConnection = peerConnectionRef.current;
      if (peerConnection && candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('✅ ICE candidate added');
      }
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
    }
  }, []);

  // Start call
  const startCall = useCallback(async () => {
    try {
      const offer = await createOffer();
      getSocket().emit('call-user', {
        to: remoteUser,
        from: currentUser,
        offer
      });
    } catch (error) {
      console.error('❌ Error starting call:', error);
      setCallStatus('ended');
    }
  }, [createOffer, remoteUser, currentUser]);

  // Accept call
  const acceptCall = useCallback(async () => {
    try {
      setIncomingCall(false);

      // Get the offer from the peer connection
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) {
        console.error('❌ No peer connection for accepting call');
        return;
      }

      const answer = await createAnswer();
      
      setCallStatus('connected');

      getSocket().emit('answer-call', {
        to: incomingCaller,
        from: currentUser,
        answer
      });
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
  }, [incomingCaller, currentUser]);

  // End call (local - will emit socket event)
  const endCall = useCallback(() => {
    setCallStatus('ended');
    setIncomingCall(false);

    getSocket().emit('end-call', {
      to: remoteUser,
      from: currentUser
    });

    cleanup();

    // Reset after a delay
    setTimeout(() => {
      setCallStatus(null);
    }, 1000);
  }, [remoteUser, currentUser]);

  // Handle remote end call (don't re-emit)
  const handleRemoteEndCall = useCallback(() => {
    setCallStatus('ended');
    setIncomingCall(false);
    cleanup();

    // Reset after a delay
    setTimeout(() => {
      setCallStatus(null);
    }, 1000);
  }, []);

  // Cleanup resources
  const cleanup = useCallback(() => {
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Clear remote audio
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    iceCandidatesRef.current = [];
  }, []);

  return {
    callStatus,
    incomingCall,
    incomingCaller,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    handleRemoteEndCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    cleanup
  };
};
