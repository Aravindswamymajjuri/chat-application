import React, { useState } from 'react';
import { authAPI } from '../utils/api';
import '../styles/Settings.css';

const Settings = ({ currentUsername, isOpen, onClose, hasAppLock, onAppLockChange }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSetAppLock = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!password || !confirmPassword) {
      setError('Both fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    setLoading(true);

    try {
      await authAPI.setAppLockPassword(currentUsername, password);
      setSuccess('App lock password set successfully! 🔒');
      
      // Enable app lock
      await authAPI.toggleAppLock(currentUsername, true);
      onAppLockChange?.(true);
      
      setTimeout(() => {
        setPassword('');
        setConfirmPassword('');
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set app lock password');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableAppLock = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await authAPI.toggleAppLock(currentUsername, false);
      setSuccess('App lock disabled ✓');
      onAppLockChange?.(false);
      
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disable app lock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h2>⚙️ Settings</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <h3>🔒 App Lock</h3>
            
            {hasAppLock ? (
              <div className="app-lock-status active">
                <p className="status-text">✓ App lock is <strong>ENABLED</strong></p>
                <p className="settings-description">
                  Your chat app is protected with a password.
                </p>
                <button 
                  type="button"
                  disabled={loading}
                  className="disable-btn"
                  onClick={handleDisableAppLock}
                >
                  {loading ? 'Disabling...' : 'Disable App Lock'}
                </button>
              </div>
            ) : (
              <div className="app-lock-status inactive">
                <p className="status-text">✗ App lock is <strong>DISABLED</strong></p>
                <p className="settings-description">
                  No password protection. Set a password below to enable app lock.
                </p>
              </div>
            )}
            
            <div className="divider"></div>
            
            <p className="settings-description">
              Set a password to lock the entire chat app. You'll need to unlock it when switching tabs or after refreshing the page.
            </p>

            <form onSubmit={handleSetAppLock} className="settings-form">
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  disabled={loading}
                  required
                />
              </div>

              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}

              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? 'Setting...' : 'Set App Lock Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
