import React, { useEffect, useState } from 'react';
import { callAPI } from '../utils/api';
import '../styles/CallHistory.css';

const CallHistory = ({ currentUser, selectedUser }) => {
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, incoming, outgoing

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
      console.error('❌ Error fetching call history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) {
      return `${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const getCallIcon = (call) => {
    if (call.callerId === currentUser.username) {
      return '📱'; // Outgoing call
    } else {
      return '📲'; // Incoming call
    }
  };

  const getNetworkQualityColor = (quality) => {
    switch (quality) {
      case 'excellent':
        return '#10b981';
      case 'good':
        return '#3b82f6';
      case 'fair':
        return '#f59e0b';
      case 'poor':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const filteredCalls = callHistory.filter((call) => {
    if (filter === 'incoming') {
      return call.callerId !== currentUser.username;
    } else if (filter === 'outgoing') {
      return call.callerId === currentUser.username;
    }
    return true;
  });

  const handleDeleteCall = async (callId) => {
    try {
      await callAPI.deleteCall(callId);
      setCallHistory((prev) => prev.filter((c) => c._id !== callId));
    } catch (error) {
      console.error('❌ Error deleting call:', error);
    }
  };

  const handleClearHistory = async () => {
    if (confirm('Clear all call history with this user?')) {
      try {
        await callAPI.clearCallHistory(currentUser.username);
        setCallHistory([]);
      } catch (error) {
        console.error('❌ Error clearing call history:', error);
      }
    }
  };

  if (!selectedUser) {
    return null;
  }

  return (
    <div className="call-history">
      <div className="call-history-header">
        <h3>📞 Call History: {selectedUser.username}</h3>
        <button 
          className="clear-history-btn" 
          onClick={handleClearHistory}
          disabled={callHistory.length === 0}
        >
          🗑️ Clear
        </button>
      </div>

      {/* Filter Tabs */}
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
          📲 Incoming ({callHistory.filter(c => c.callerId !== currentUser.username).length})
        </button>
        <button 
          className={`filter-btn ${filter === 'outgoing' ? 'active' : ''}`}
          onClick={() => setFilter('outgoing')}
        >
          📱 Outgoing ({callHistory.filter(c => c.callerId === currentUser.username).length})
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
          {filteredCalls.map((call) => (
            <div key={call._id} className="call-history-item">
              <div className="call-item-icon">{getCallIcon(call)}</div>
              
              <div className="call-item-info">
                <div className="call-item-user">
                  {call.callerId === currentUser.username
                    ? `Called ${call.receiverId}`
                    : `Called by ${call.callerId}`}
                </div>
                <div className="call-item-details">
                  <span className="call-duration">⏱️ {formatDuration(call.duration)}</span>
                  <span 
                    className="call-network-quality"
                    style={{ color: getNetworkQualityColor(call.networkQuality) }}
                    title={`Network: ${call.networkQuality}`}
                  >
                    📶 {call.networkQuality}
                  </span>
                </div>
                <div className="call-item-time">
                  {new Date(call.startTime).toLocaleString()}
                </div>
              </div>

              <button
                className="delete-call-btn"
                onClick={() => handleDeleteCall(call._id)}
                title="Delete this call"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CallHistory;
