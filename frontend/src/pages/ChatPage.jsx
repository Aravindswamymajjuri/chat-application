import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import MessageInput from '../components/MessageInput';
import AppLockModal from '../components/AppLockModal';
import Settings from '../components/Settings';
import { authAPI, usersAPI } from '../utils/api';
import { disconnectSocket, emitUserLogout, initializeSocket, emitUserJoin } from '../utils/socket';
import { setupForegroundNotifications, requestFCMToken, registerServiceWorker } from '../utils/firebase';
import { useAppSecurity, setAppLockSession, wasAppLocked } from '../utils/security';
import '../styles/ChatPage.css';

const ChatPage = ({ currentUser, onLogout }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [appLockModalOpen, setAppLockModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [hasAppLock, setHasAppLock] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  // Check if app lock is enabled
  useEffect(() => {
    const checkAppLock = async () => {
      try {
        const response = await authAPI.checkAppLock(currentUser.username);
        const appLockEnabled = response.data?.hasAppLock === true;
        setHasAppLock(appLockEnabled);
        
        console.log('🔍 App lock check result:', appLockEnabled);
        
        // Show modal if app lock is enabled and user wasn't already verified
        if (appLockEnabled && wasAppLocked(currentUser.username)) {
          console.log('🔒 Showing app lock modal');
          setAppLockModalOpen(true);
        } else if (appLockEnabled) {
          // User was already verified in this session
          console.log('✅ User already verified in this session');
          setAppLockSession(currentUser.username);
        }
      } catch (error) {
        console.error('⚠️  Error checking app lock (non-blocking):', error.message);
        // Don't crash if app lock check fails - app can still work
        setHasAppLock(false);
      }
    };

    if (currentUser?.username) {
      checkAppLock();
    }
  }, [currentUser.username]);

  // Setup security listeners (tab switch, window focus, etc)
  useAppSecurity(
    currentUser.username,
    hasAppLock,
    () => setAppLockModalOpen(true)
  );

  useEffect(() => {
    // Initialize Socket.IO when ChatPage loads (for page refreshes)
    const socket = initializeSocket();
    console.log('🔌 Socket.IO initialized for restored session');
    
    // Emit user join to notify others
    emitUserJoin(currentUser.username);

    // Setup foreground notifications
    setupForegroundNotifications((notification) => {
      console.log('🔔 Notification received:', notification);
      if (notification.notification) {
        alert(`💬 ${notification.notification.title}\n${notification.notification.body}`);
      }
    });

    // Try to update FCM token on page load
    (async () => {
      try {
        await registerServiceWorker();
        const fcmToken = await requestFCMToken();
        if (fcmToken && currentUser._id) {
          await authAPI.updateFCMToken(currentUser._id, fcmToken);
          console.log('✅ FCM token updated on page load');
        }
      } catch (error) {
        console.warn('Could not update FCM token:', error.message);
      }
    })();

    return () => {
      // Cleanup on unmount
      // Don't disconnect socket - just remove listener
    };
  }, [currentUser._id, currentUser.username]);

  const handleLogout = async () => {
    try {
      await authAPI.logout(currentUser._id);
      emitUserLogout(currentUser.username);
      disconnectSocket();
      onLogout();
    } catch (error) {
      console.error('Logout error:', error);
      onLogout();
    }
  };

  const handleAppLockUnlock = () => {
    setAppLockSession(currentUser.username);
    setAppLockModalOpen(false);
  };

  const handleToggleAppLock = async () => {
    try {
      if (hasAppLock) {
        // Turn OFF app lock - but first set a flag to know it's disabled
        // For now, we show settings to disable it
        setSettingsModalOpen(true);
      } else {
        // Turn ON app lock - show settings to set password
        setSettingsModalOpen(true);
      }
    } catch (error) {
      console.error('Error toggling app lock:', error);
    }
  };

  const handleMessageSent = (message) => {
    setMessages((prev) => [...prev, message]);
  };

  return (
    <div className="chat-page">
      <AppLockModal
        username={currentUser.username}
        onUnlock={handleAppLockUnlock}
        isOpen={appLockModalOpen}
      />

      <Settings
        currentUsername={currentUser.username}
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        hasAppLock={hasAppLock}
        onAppLockChange={(enabled) => setHasAppLock(enabled)}
      />

      {/* Fixed Header */}
      <div className="app-header">
        <div className="header-left">
          <button 
            className="hamburger-btn" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Toggle sidebar"
          >
            ☰
          </button>
          <span className="current-username">👤 {currentUser.username}</span>
          <div className="user-status-indicator online"></div>
        </div>
        <div className="header-right">
          <button className="header-settings-btn" onClick={() => setSettingsModalOpen(true)} title="Settings">
            ⚙️
          </button>
          <button className="header-logout-btn" onClick={handleLogout} title="Logout">
            🚪
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`chat-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Sidebar
          currentUser={currentUser}
          selectedUser={selectedUser}
          onSelectUser={setSelectedUser}
          users={users}
          setUsers={setUsers}
        />

        <div className="chat-main">
          <ChatWindow
            currentUser={currentUser}
            selectedUser={selectedUser}
            messages={messages}
            setMessages={setMessages}
            onReply={(msg) => setReplyingTo(msg)}
          />

          {selectedUser && (
            <MessageInput
              currentUser={currentUser}
              selectedUser={selectedUser}
              onMessageSent={handleMessageSent}
              replyingTo={replyingTo}
              onReplyCancel={() => setReplyingTo(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
