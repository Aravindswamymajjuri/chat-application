import React, { useState } from 'react';
import { authAPI } from '../utils/api';
import '../styles/Settings.css';

const Settings = ({ currentUsername, onClose, hasAppLock, onAppLockChange }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  const handleSetAppLock = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!password || !confirmPassword) { setError('Both fields are required'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 4) { setError('Minimum 4 characters'); return; }
    setLoading(true);
    try {
      await authAPI.setAppLockPassword(currentUsername, password);
      await authAPI.toggleAppLock(currentUsername, true);
      setPassword('');
      setConfirmPassword('');
      onClose();
      onAppLockChange?.(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set app lock');
    } finally { setLoading(false); }
  };

  const handleConfirmDisable = async () => {
    if (!disablePassword) { setError('Enter your password'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      await authAPI.verifyAppLockPassword(currentUsername, disablePassword);
      await authAPI.toggleAppLock(currentUsername, false);
      // Close immediately — don't let hasAppLock change re-render to enable form
      setDisablePassword('');
      setShowDisableConfirm(false);
      onClose();
      onAppLockChange?.(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect password');
    } finally { setLoading(false); }
  };

  const handleClose = () => {
    setError(''); setSuccess('');
    setPassword(''); setConfirmPassword(''); setDisablePassword('');
    setShowDisableConfirm(false);
    onClose();
  };

  return (
    <div className="st-panel">
      {/* Back bar */}
      <div className="st-back-bar">
        <button className="st-back-btn" onClick={handleClose} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="st-back-title">Settings</span>
      </div>

      {/* Content — doodle bg, card centered */}
      <div className="st-content">
        <div className="st-card">

          {/* Lock icon + title */}
          <div className="st-card-top">
            <div className="st-icon-circle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2 className="st-card-title">App Lock</h2>
            <p className="st-card-desc">
              {hasAppLock
                ? 'Your chats are protected with a password'
                : 'Secure your chats with a password'}
            </p>
            <div className={`st-badge ${hasAppLock ? 'on' : 'off'}`}>
              <span className="st-badge-dot" />
              {hasAppLock ? 'Enabled' : 'Disabled'}
            </div>
          </div>

          {/* Divider */}
          <div className="st-divider" />

          {/* Form area */}
          <div className="st-card-body">
            {!hasAppLock ? (
              <form onSubmit={handleSetAppLock} className="st-form">
                <div className="st-field">
                  <label htmlFor="st-pw">Password</label>
                  <input
                    id="st-pw"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <div className="st-field">
                  <label htmlFor="st-cpw">Confirm Password</label>
                  <input
                    id="st-cpw"
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                    disabled={loading}
                  />
                </div>
                {error && <p className="st-error">{error}</p>}
                {success && <p className="st-success">{success}</p>}
                <button type="submit" className="st-btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Enable App Lock'}
                </button>
              </form>
            ) : (
              <div className="st-form">
                {!showDisableConfirm ? (
                  <>
                    <p className="st-hint">To disable app lock, verify your password.</p>
                    {error && <p className="st-error">{error}</p>}
                    {success && <p className="st-success">{success}</p>}
                    <button
                      type="button"
                      className="st-btn-danger"
                      onClick={() => { setShowDisableConfirm(true); setError(''); }}
                      disabled={loading}
                    >
                      Disable App Lock
                    </button>
                  </>
                ) : (
                  <>
                    <div className="st-field">
                      <label htmlFor="st-dpw">Current Password</label>
                      <input
                        id="st-dpw"
                        type="password"
                        placeholder="Enter your password"
                        value={disablePassword}
                        onChange={e => { setDisablePassword(e.target.value); setError(''); }}
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                    {error && <p className="st-error">{error}</p>}
                    {success && <p className="st-success">{success}</p>}
                    <div className="st-btn-row">
                      <button
                        type="button"
                        className="st-btn-ghost"
                        onClick={() => { setShowDisableConfirm(false); setDisablePassword(''); setError(''); }}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="st-btn-danger"
                        onClick={handleConfirmDisable}
                        disabled={loading}
                      >
                        {loading ? 'Verifying...' : 'Disable'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
