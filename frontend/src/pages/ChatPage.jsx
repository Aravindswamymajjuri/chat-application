import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import MessageInput from '../components/MessageInput';
import AppLockModal from '../components/AppLockModal';
import Settings from '../components/Settings';
import { authAPI, usersAPI } from '../utils/api';
import { disconnectSocket, emitUserLogout, initializeSocket, emitUserJoin, onUnreadCountUpdated, onUnreadCountCleared, emitClearUnreadCount } from '../utils/socket';
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
  // Track unread message counts: { username: count }
  const [unreadCounts, setUnreadCounts] = useState({});

  // Memoize callback functions to prevent infinite loops in child components
  const handleClearUnread = useCallback((username) => {
    setUnreadCounts((prev) => {
      const updated = { ...prev };
      delete updated[username];
      return updated;
    });
  }, []);

  const handleIncrementUnread = useCallback((username) => {
    setUnreadCounts((prev) => ({
      ...prev,
      [username]: (prev[username] || 0) + 1
    }));
  }, []);

  const handleReply = useCallback((msg) => {
    setReplyingTo(msg);
  }, []);

  // Emit clear-unread-count when user selects a different chat
  useEffect(() => {
    if (selectedUser) {
      console.log(`📤 Emitting clear-unread-count from ChatPage for ${selectedUser.username}`);
      emitClearUnreadCount(currentUser.username, selectedUser.username);
    }
  }, [selectedUser?.username, currentUser.username]);

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
    // Initialize Socket.IO when ChatPage loads
    const socket = initializeSocket();
    console.log('🔌 Socket.IO initialized');
    
    // Register user - will emit immediately or on reconnect
    emitUserJoin(currentUser.username);

    // Setup foreground notifications
    setupForegroundNotifications((notification) => {
      console.log('🔔 Notification received:', notification);
      if (notification.notification) {
        alert(`💬 ${notification.notification.title}\n${notification.notification.body}`);
      }
    });

    // Initialize FCM notifications with proper sequencing
    const initializeFCM = async () => {
      try {
        console.log('🔔 Starting FCM initialization...');
        
        // Step 1: Register Service Worker first (MUST be before requesting token)
        const swRegistration = await registerServiceWorker();
        if (!swRegistration) {
          console.warn('⚠️ Service Worker registration returned null');
          return;
        }
        console.log('✅ Service Worker registered successfully');

        // Step 2: Wait a bit for Service Worker to be active
        let retries = 0;
        while (!swRegistration.active && retries < 10) {
          console.log(`⏳ Waiting for Service Worker to become active... (${retries + 1}/10)`);
          await new Promise(resolve => setTimeout(resolve, 500));
          retries++;
        }

        if (!swRegistration.active) {
          console.warn('⚠️ Service Worker did not become active within timeout');
          return;
        }

        console.log('✅ Service Worker is now active');

        // Step 3: Request FCM token (now that SW is active)
        const fcmToken = await requestFCMToken();
        if (!fcmToken) {
          console.warn('⚠️ FCM token request returned null/empty');
          return;
        }
        console.log('✅ FCM Token obtained successfully');

        // Step 4: Send token to backend
        if (currentUser._id) {
          await authAPI.updateFCMToken(currentUser._id, fcmToken);
          console.log('✅ FCM token sent to backend and stored in database');
        } else {
          console.warn('⚠️ User ID missing - cannot store FCM token on backend');
        }
      } catch (error) {
        console.error('❌ FCM initialization failed:', error);
        console.error('Notification details:', {
          message: error.message,
          stack: error.stack
        });
      }
    };

    // Start FCM initialization
    initializeFCM();

    return () => {
      // Cleanup on unmount
      // Socket remains connected for page refresh - just stop listening
    };
  }, [currentUser._id, currentUser.username]);

  // Fetch unread message counts on load
  useEffect(() => {
    const fetchUnreadCounts = async () => {
      try {
        console.log('📬 Fetching unread message counts...');
        const response = await usersAPI.getUnreadCounts(currentUser._id);
        setUnreadCounts(response.data.unreadCounts || {});
        console.log('✅ Unread counts loaded:', response.data.unreadCounts);
      } catch (error) {
        console.warn('Could not fetch unread counts:', error.message);
      }
    };

    if (currentUser._id) {
      fetchUnreadCounts();
    }
  }, [currentUser._id]);

  // Listen for unread count updates via socket
  useEffect(() => {
    const unsubscribeUpdated = onUnreadCountUpdated((data) => {
      console.log('📬 Unread count updated:', data);
      setUnreadCounts((prev) => ({
        ...prev,
        [data.senderUsername]: data.count
      }));
    });

    const unsubscribeCleared = onUnreadCountCleared((data) => {
      console.log('✅ Unread count cleared:', data);
      setUnreadCounts((prev) => {
        const updated = { ...prev };
        delete updated[data.senderUsername];
        return updated;
      });
    });

    return () => {
      unsubscribeUpdated();
      unsubscribeCleared();
    };
  }, []);

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
          unreadCounts={unreadCounts}
        />

        <div className="chat-main">
          <ChatWindow
            currentUser={currentUser}
            selectedUser={selectedUser}
            messages={messages}
            setMessages={setMessages}
            onReply={handleReply}
            unreadCounts={unreadCounts}
            onClearUnread={handleClearUnread}
            onIncrementUnread={handleIncrementUnread}
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
