import React, { useState } from 'react';
import { authAPI } from '../utils/api';
import { requestFCMToken, registerServiceWorker } from '../utils/firebase';
import { initializeSocket, emitUserJoin } from '../utils/socket';
import '../styles/Auth.css';

const Auth = ({ onAuthSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.register(username, password);
      alert('Registration successful! Please login.');
      setIsRegister(false);
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Initialize Socket.IO
      initializeSocket();

      // Register Service Worker
      await registerServiceWorker();

      // Request FCM token
      const fcmToken = await requestFCMToken();

      // Login
      const response = await authAPI.login(username, password);
      const user = response.data.user;

      // Update FCM token in backend
      if (fcmToken) {
        await authAPI.updateFCMToken(user._id, fcmToken);
      }

      // Emit user join event
      emitUserJoin(user.username);

      // Call success callback
      onAuthSuccess(user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-brand">
        <svg className="auth-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <h2>Chattie</h2>
      </div>

      <div className="auth-box">
        <h1>{isRegister ? 'Create Account' : 'Welcome Back'}</h1>
        <p className="auth-subtitle">
          {isRegister ? 'Sign up to start chatting' : 'Sign in to continue'}
        </p>

        <div className="auth-toggle">
          <button
            className={!isRegister ? 'active' : ''}
            onClick={() => {
              setIsRegister(false);
              setError('');
            }}
          >
            Login
          </button>
          <button
            className={isRegister ? 'active' : ''}
            onClick={() => {
              setIsRegister(true);
              setError('');
            }}
          >
            Register
          </button>
        </div>

        <form onSubmit={isRegister ? handleRegister : handleLogin}>
          <div className="auth-input-group">
            <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
              autoComplete="username"
            />
          </div>
          <div className="auth-input-group">
            <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {error && <div className="auth-error">{error}</div>}
      </div>
    </div>
  );
};

export default Auth;
