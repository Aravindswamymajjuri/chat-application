import React, { useEffect, useState } from 'react';
import { callAPI } from '../utils/api';
import '../styles/CallHistory.css';

const CallHistory = ({ currentUser, selectedUser, onClose }) => {
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (currentUser && selectedUser) {
      fetchCallHistory();
    }
  }, [currentUser, selectedUser]);

  const fetchCallHistory = async () => {
    setLoading(true);
    try {
      const response = await callAPI.getCallHistoryWith(
        currentUser.username,
        selectedUser.username,
        50
      );
      setCallHistory(response.data.calls || []);
    } catch (error) {
      console.error('Error fetching call history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const filteredCalls = callHistory.filter((call) => {
    if (filter === 'incoming') return call.callerId !== currentUser.username;
    if (filter === 'outgoing') return call.callerId === currentUser.username;
    return true;
  });

  const handleDeleteCall = async (callId) => {
    try {
      await callAPI.deleteCall(callId);
      setCallHistory((prev) => prev.filter((c) => c._id !== callId));
    } catch (error) {
      console.error('Error deleting call:', error);
    }
  };

  const handleClearHistory = async () => {
    if (confirm('Clear all call history with this user?')) {
      try {
        await callAPI.clearCallHistory(currentUser.username);
        setCallHistory([]);
      } catch (error) {
        console.error('Error clearing call history:', error);
      }
    }
  };

  if (!selectedUser) return null;

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="call-history">
      <div className="call-history-header">
        {onClose && (
          <button className="call-history-back" onClick={onClose} aria-label="Back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
        <h3>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          Call History
        </h3>
        <button
          className="clear-history-btn"
          onClick={handleClearHistory}
          disabled={callHistory.length === 0}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Clear
        </button>
      </div>

      <div className="call-history-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({callHistory.length})
        </button>
        <button
          className={`filter-btn ${filter === 'incoming' ? 'active' : ''}`}
          onClick={() => setFilter('incoming')}
        >
          Incoming
        </button>
        <button
          className={`filter-btn ${filter === 'outgoing' ? 'active' : ''}`}
          onClick={() => setFilter('outgoing')}
        >
          Outgoing
        </button>
      </div>

      {loading ? (
        <div className="call-history-loading">Loading call history...</div>
      ) : filteredCalls.length === 0 ? (
        <div className="call-history-empty">
          <p>No {filter !== 'all' ? filter : ''} calls with {selectedUser.username}</p>
        </div>
      ) : (
        <div className="call-history-list">
          {filteredCalls.map((call) => {
            const isOutgoing = call.callerId === currentUser.username;
            return (
              <div key={call._id} className="call-history-item">
                <div className={`call-item-icon ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                  {isOutgoing ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="7 17 17 7"/>
                      <polyline points="7 7 17 7 17 17"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 7 7 17"/>
                      <polyline points="17 17 7 17 7 7"/>
                    </svg>
                  )}
                </div>

                <div className="call-item-info">
                  <div className="call-item-user">
                    {isOutgoing ? call.receiverId : call.callerId}
                  </div>
                  <div className="call-item-details">
                    <span>{formatDuration(call.duration)}</span>
                    <span>{call.networkQuality}</span>
                  </div>
                </div>

                <div className="call-item-time">{formatTime(call.startTime)}</div>

                <button
                  className="delete-call-btn"
                  onClick={() => handleDeleteCall(call._id)}
                  title="Delete"
                  aria-label="Delete call"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CallHistory;
