import { useEffect, useRef } from 'react';

export const useAppSecurity = (username, hasAppLock, onAppLockNeeded) => {
  const isLockedRef = useRef(false);

  useEffect(() => {
    if (!hasAppLock || !username || !onAppLockNeeded) {
      console.log('⏭️  Skipping security setup:', { hasAppLock, username });
      return;
    }

    console.log('🔒 Activating app security for:', username);
    isLockedRef.current = true;

    // Handle page visibility changes (tab switching)
    const handleVisibilityChange = () => {
      console.log('📱 Tab visibility changed:', {
        hidden: document.hidden,
        locked: isLockedRef.current
      });

      if (document.hidden) {
        // User switched away from tab
        isLockedRef.current = true;
        console.log('🔒 App locked - user switched tabs');
      } else {
        // User switched back to tab
        if (isLockedRef.current) {
          console.log('🔓 Requesting unlock - user switched back');
          onAppLockNeeded();
        }
      }
    };

    // Handle window blur (click outside)
    const handleWindowBlur = () => {
      console.log('❌ Window lost focus');
      isLockedRef.current = true;
    };

    // Handle window focus (click back)
    const handleWindowFocus = () => {
      console.log('✅ Window gained focus');
      if (isLockedRef.current) {
        console.log('🔓 Requesting unlock - window refocused');
        onAppLockNeeded();
      }
    };

    // Attach listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    console.log('✅ Security listeners attached');

    // Cleanup
    return () => {
      console.log('🧹 Removing security listeners');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [hasAppLock, username, onAppLockNeeded]);
};

// Store app lock status in sessionStorage
export const setAppLockSession = (username) => {
  if (username) {
    sessionStorage.setItem(`appLockStatus_${username}`, 'verified');
    console.log('✅ App unlocked - session set for:', username);
  }
};

// Clear app unlock timestamp
export const clearAppLockSession = (username) => {
  if (username) {
    sessionStorage.removeItem(`appLockStatus_${username}`);
    console.log('🔒 App lock session cleared for:', username);
  }
};

// Check if user was locked/logged out
export const wasAppLocked = (username) => {
  if (!username) return false;
  const isVerified = sessionStorage.getItem(`appLockStatus_${username}`) === 'verified';
  console.log('🔍 App lock check:', username, '→', isVerified ? 'UNLOCKED' : 'LOCKED');
  return !isVerified;
};
