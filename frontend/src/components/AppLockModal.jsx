import React, { useState } from 'react';
import { authAPI } from '../utils/api';
import '../styles/AppLockModal.css';

const AppLockModal = ({ username, onUnlock, isOpen }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.verifyAppLockPassword(username, password);
      setPassword('');
      onUnlock();
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-lock-overlay">
      <div className="app-lock-modal">
        <div className="app-lock-header">
          <h2>🔒 App Lock</h2>
          <p>Enter password to continue</p>
        </div>

        <form onSubmit={handleVerify} className="app-lock-form">
          <input
            type="password"
            placeholder="Enter app lock password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            disabled={loading}
            autoFocus
            required
          />

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading || !password}>
            {loading ? 'Verifying...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AppLockModal;
