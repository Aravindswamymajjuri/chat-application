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
    if (!password || !confirmPassword) { setError('Both fields are required'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 4) { setError('Password must be at least 4 characters'); return; }

    setLoading(true);
    try {
      await authAPI.setAppLockPassword(currentUsername, password);
      await authAPI.toggleAppLock(currentUsername, true);
      onAppLockChange?.(true);
      setSuccess('App lock enabled');
      setTimeout(() => { setPassword(''); setConfirmPassword(''); onClose(); }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set app lock');
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
      setSuccess('App lock disabled');
      onAppLockChange?.(false);
      setTimeout(() => onClose(), 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disable app lock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <h3>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              App Lock
            </h3>

            {hasAppLock ? (
              <div className="app-lock-status active">
                <p className="status-text">App lock is enabled</p>
                <p className="settings-description">Your chat is protected with a password.</p>
                <button type="button" disabled={loading} className="disable-btn" onClick={handleDisableAppLock}>
                  {loading ? 'Disabling...' : 'Disable App Lock'}
                </button>
              </div>
            ) : (
              <div className="app-lock-status inactive">
                <p className="status-text">App lock is disabled</p>
                <p className="settings-description">Set a password to protect your chats.</p>
              </div>
            )}

            <div className="divider"></div>

            <form onSubmit={handleSetAppLock} className="settings-form">
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" placeholder="Enter password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} disabled={loading} required />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input id="confirmPassword" type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }} disabled={loading} required />
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
