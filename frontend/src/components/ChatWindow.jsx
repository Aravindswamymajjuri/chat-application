import React, { useEffect, useState, useRef } from 'react';
import { chatAPI } from '../utils/api';
import { 
  onReceiveMessage, onDeleteMessage, onDeleteMessageForMe, onTypingIndicator, 
  onStopTyping, onMessageStatusUpdated, onCallUser, onAnswerCall, onIceCandidate, onEndCall, emitMessageSeen, emitMessageDelivered 
} from '../utils/socket';
import MessageActions from './MessageActions';
import CallScreen from './CallScreen';
import IncomingCallPopup from './IncomingCallPopup';
import CallHistory from './CallHistory';
import { useWebRTC } from '../hooks/useWebRTC';
import '../styles/ChatWindow.css';

const ChatWindow = ({ currentUser, selectedUser, messages, setMessages, onReply }) => {
  const [loading, setLoading] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // WebRTC Hook
  const {
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
    cleanup,
    callDuration,
    isMuted,
    speakerEnabled,
    networkQuality,
    networkWarning,
    toggleMute,
    toggleSpeaker
  } = useWebRTC(currentUser.username, selectedUser?.username);

  // Set up all socket listeners first (component mount)
  useEffect(() => {
    console.log('🔌 Setting up socket listeners (on component mount)');
  }, []);

  // Subscribe to message status updates
  useEffect(() => {
    const unsubscribe = onMessageStatusUpdated((data) => {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📖 message-status-updated event received`);
      console.log(`   Message ID: ${data.messageId}`);
      console.log(`   From: ${data.sender} (sender)`);
      console.log(`   To: ${data.receiver} (reader)`);
      console.log(`   New Status: ${data.status}`);
      console.log(`   Current user: ${currentUser.username}`);
      console.log(`${'='.repeat(70)}`);
      
      // Update messages when status changes
      if (data.sender === currentUser.username) {
        console.log(`✅ This is our message, updating UI...`);
        setMessages((prev) => {
          let found = false;
          const updated = prev.map((msg) => {
            // Convert both to strings for comparison (handle MongoDB ObjectId)
            const msgIdStr = String(msg._id);
            const dataIdStr = String(data.messageId);
            
            if (msgIdStr === dataIdStr) {
              console.log(`   ✓✓ Match found! Updating "${msg.text.substring(0, 30)}" from "${msg.status}" to "${data.status}"`);
              found = true;
              return { ...msg, status: data.status };
            }
            return msg;
          });
          
          if (!found) {
            console.log(`⚠️ No message matched with ID ${data.messageId}`);
            console.log(`   Available messages:`, prev.map(m => ({ id: String(m._id), sender: m.sender })));
          }
          
          return updated;
        });
      } else {
        console.log(`⚠️ This is not our message (sender is ${data.sender})`);
      }
    });

    return unsubscribe;
  }, [currentUser.username]);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages();
    }
  }, [selectedUser]);

  useEffect(() => {
    // Subscribe to incoming messages
    const unsubscribe = onReceiveMessage((message) => {
      console.log('📨 Message received from Socket:', message);
      
      // Update messages if this message is for the current conversation
      // Check both directions: sender→receiver and receiver→sender
      const isForCurrentConversation = 
        (message.sender === currentUser.username && message.receiver === selectedUser.username) ||
        (message.sender === selectedUser.username && message.receiver === currentUser.username);
      
      if (isForCurrentConversation) {
        console.log('✅ Adding message to conversation');
        console.log(`   Message ID: ${String(message._id)}`);
        
        // Emit message-delivered immediately
        console.log(`📦 Emitting message-delivered for: ${message.sender}`);
        emitMessageDelivered(message._id, currentUser.username, message.sender);
        
        // If chat is already open, mark as seen immediately
        console.log(`👁️ Emitting message-seen immediately (chat is open)`);
        emitMessageSeen(message._id, currentUser.username, message.sender);
        
        setMessages((prev) => {
          // Check if message already exists (to avoid duplicates from onMessageSent)
          const isDuplicate = prev.some(
            (m) => m.sender === message.sender && 
                   m.receiver === message.receiver &&
                   m.text === message.text && 
                   Math.abs(new Date(m.timestamp) - new Date(message.timestamp)) < 2000
          );
          
          if (isDuplicate) {
            console.log('⚠️ Duplicate message ignored - already added via callback');
            return prev;
          }
          
          return [...prev, message];
        });
      } else {
        console.log('❌ Message not for current conversation', {
          messageSender: message.sender,
          messageReceiver: message.receiver,
          currentUser: currentUser.username,
          selectedUser: selectedUser.username
        });
      }
    });

    return unsubscribe;
  }, [selectedUser, currentUser.username, setMessages]);

  useEffect(() => {
    // Subscribe to message deletion events (for everyone)
    const unsubscribe = onDeleteMessage((data) => {
      console.log('🗑️ Message deleted:', data.messageId);
      setMessages((prev) => prev.filter((msg) => msg._id !== data.messageId));
    });

    return unsubscribe;
  }, [setMessages]);

  useEffect(() => {
    // Subscribe to message deletion for me only
    const unsubscribe = onDeleteMessageForMe((data) => {
      console.log('🗑️ Message deleted for me:', data.messageId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId && data.username !== currentUser.username
            ? { ...msg, text: '[Deleted message]', deletedForMe: true }
            : msg
        )
      );
    });

    return unsubscribe;
  }, [setMessages, currentUser.username]);

  useEffect(() => {
    // Subscribe to typing indicator
    const unsubscribe = onTypingIndicator((data) => {
      if (data.username === selectedUser?.username && data.receiver === currentUser.username) {
        setIsTyping(true);
      }
    });

    return unsubscribe;
  }, [selectedUser, currentUser.username]);

  useEffect(() => {
    // Subscribe to stop typing
    const unsubscribe = onStopTyping((data) => {
      if (data.username === selectedUser?.username && data.receiver === currentUser.username) {
        setIsTyping(false);
      }
    });

    return unsubscribe;
  }, [selectedUser, currentUser.username]);

  // WebRTC Call Event Listeners
  useEffect(() => {
    const unsubscribeCall = onCallUser((data) => {
      console.log('📞 Incoming call from:', data.from);
      handleOffer(data.offer, data.from);
    });

    return unsubscribeCall;
  }, [handleOffer]);

  useEffect(() => {
    const unsubscribeAnswer = onAnswerCall((data) => {
      console.log('✅ Call answered by:', data.from);
      handleAnswer(data.answer);
    });

    return unsubscribeAnswer;
  }, [handleAnswer]);

  useEffect(() => {
    const unsubscribeIce = onIceCandidate((data) => {
      console.log('📡 ICE candidate received');
      handleIceCandidate(data.candidate);
    });

    return unsubscribeIce;
  }, [handleIceCandidate]);

  useEffect(() => {
    const unsubscribeEnd = onEndCall((data) => {
      console.log('📵 Call ended by:', data.from);
      handleRemoteEndCall();
    });

    return unsubscribeEnd;
  }, [handleRemoteEndCall]);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const response = await chatAPI.getMessages(currentUser.username, selectedUser.username);
      
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📨 API Response received with ${response.data.length} messages`);
      response.data.forEach(msg => {
        console.log(`   - ${msg.sender} → ${msg.receiver}: status=${msg.status}, _id=${String(msg._id)}`);
      });
      
      setMessages(response.data);
      console.log(`✅ State updated with ${response.data.length} messages`);
      
      // Emit socket event to mark unseen messages as seen in real-time
      console.log(`\n📤 Emitting message-seen for unseen messages...`);
      response.data.forEach(msg => {
        if (msg.sender === selectedUser.username && msg.status !== 'seen') {
          console.log(`   📤 Emitting for message: ${String(msg._id)} from ${msg.sender}`);
          emitMessageSeen(msg._id, currentUser.username, msg.sender);
        }
      });
      console.log(`${'='.repeat(70)}\n`);
      
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = (messageId, forMeOnly = false) => {
    if (forMeOnly) {
      // For "delete for me", show as deleted but keep in array
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, text: '[Deleted message]', deletedForMe: true } : msg
        )
      );
    } else {
      // For "delete for everyone", remove completely
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    }
  };

  const handleReplyClick = (message) => {
    if (onReply) {
      onReply({
        id: message._id,
        text: message.text,
        sender: message.sender
      });
    }
  };

  const handleStartCall = () => {
    if (selectedUser.isOnline) {
      startCall();
    } else {
      alert(`${selectedUser.username} is offline`);
    }
  };

  if (!selectedUser) {
    return (
      <div className="chat-window empty">
        <div className="empty-state">
          <h2>Select a user to start chatting</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {/* Call Screen (Full screen overlay) */}
      {callStatus && <CallScreen 
        callStatus={callStatus} 
        remoteUser={selectedUser.username}
        onEndCall={endCall}
        remoteAudioRef={remoteAudioRef}
        isMuted={isMuted}
        callDuration={callDuration}
        networkQuality={networkQuality}
        networkWarning={networkWarning}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
        speakerEnabled={speakerEnabled}
      />}

      {/* Incoming Call Popup */}
      {incomingCall && <IncomingCallPopup 
        caller={incomingCaller}
        onAccept={acceptCall}
        onReject={rejectCall}
      />}

      <div className="chat-header">
        <div className="header-info">
          <h2>{selectedUser.username}</h2>
          {isTyping ? (
            <div className="typing-indicator">
              <span>✍️ typing...</span>
              <div className="typing-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          ) : (
            <div className={`user-status ${selectedUser.isOnline ? 'online' : 'offline'}`}>
              {selectedUser.isOnline ? '🟢 Online' : '🔘 Offline'}
            </div>
          )}
        </div>
        <div className="header-actions">
          <button 
            className={`history-btn ${showCallHistory ? 'active' : ''}`}
            onClick={() => setShowCallHistory(!showCallHistory)}
            title="View call history"
          >
            📞 History
          </button>
          <button 
            className="call-btn" 
            onClick={handleStartCall} 
            disabled={!selectedUser.isOnline || callStatus} 
            title={callStatus ? `${callStatus}...` : 'Call user'}
          >
            📞
          </button>
        </div>
      </div>

      <div className="chat-content-wrapper">
        <div className="messages-container">
        {loading ? (
          <div className="loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">No messages yet. Start the conversation!</div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <div
                key={msg._id || index}
                className={`message ${msg.sender === currentUser.username ? 'sent' : 'received'} ${
                  msg.deletedForMe ? 'deleted' : ''
                }`}
                onClick={() => setActiveMessageId(activeMessageId === msg._id ? null : msg._id)}
              >
                {msg.replyTo && (
                  <div className="message-reply-quote">
                    <div className="reply-quote-sender">↩️ {msg.replyTo.sender}</div>
                    <div className="reply-quote-text">{msg.replyTo.text}</div>
                  </div>
                )}
                <div className="message-content">{msg.text}</div>
                <div className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {msg.sender === currentUser.username && (
                    <span className={`read-status ${msg.status === 'seen' ? 'seen' : msg.status === 'delivered' ? 'delivered' : 'sent'}`}>
                      {msg.status === 'sent' && '✓'}
                      {msg.status === 'delivered' && '✓✓'}
                      {msg.status === 'seen' && '✓✓'}
                    </span>
                  )}
                </div>

                {activeMessageId === msg._id && !msg.deletedForMe && (
                  <MessageActions
                    messageId={msg._id}
                    message={msg}
                    currentUsername={currentUser.username}
                    isOwnMessage={msg.sender === currentUser.username}
                    onDelete={handleDeleteMessage}
                    onReply={handleReplyClick}
                    onClose={() => setActiveMessageId(null)}
                  />
                )}
              </div>
            ))}

            {isTyping && (
              <div className="message received typing-message">
                <div className="message-content typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

        {/* Call History Sidebar */}
        {showCallHistory && (
          <CallHistory 
            currentUser={currentUser} 
            selectedUser={selectedUser}
          />
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
