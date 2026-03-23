import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const authAPI = {
  register: (username, password) =>
    axios.post(`${API_BASE_URL}/auth/register`, { username, password }),

  login: (username, password) =>
    axios.post(`${API_BASE_URL}/auth/login`, { username, password }),

  logout: (userId) =>
    axios.post(`${API_BASE_URL}/auth/logout`, { userId }),

  updateFCMToken: (userId, fcmToken) =>
    axios.post(`${API_BASE_URL}/auth/update-fcm-token`, { userId, fcmToken }),

  setAppLockPassword: (username, appLockPassword) =>
    axios.post(`${API_BASE_URL}/auth/set-app-lock`, { username, appLockPassword }),

  verifyAppLockPassword: (username, appLockPassword) =>
    axios.post(`${API_BASE_URL}/auth/verify-app-lock`, { username, appLockPassword }),

  checkAppLock: (username) =>
    axios.get(`${API_BASE_URL}/auth/check-app-lock`, { params: { username } }),

  toggleAppLock: (username, enabled) =>
    axios.post(`${API_BASE_URL}/auth/toggle-app-lock`, { username, enabled })
};

export const usersAPI = {
  getAllUsers: (currentUserId) =>
    axios.get(`${API_BASE_URL}/users/all`, { params: { currentUserId } }),

  getUserById: (userId) =>
    axios.get(`${API_BASE_URL}/users/${userId}`),

  updateOnlineStatus: (userId, isOnline, socketId) =>
    axios.put(`${API_BASE_URL}/users/status`, { userId, isOnline, socketId })
};

export const chatAPI = {
  getMessages: (sender, receiver) =>
    axios.get(`${API_BASE_URL}/chat/messages`, { params: { sender, receiver } }),

  saveMessage: (sender, receiver, text, replyTo = null) =>
    axios.post(`${API_BASE_URL}/chat/messages`, { sender, receiver, text, replyTo }),

  deleteMessage: (messageId) =>
    axios.delete(`${API_BASE_URL}/chat/messages/${messageId}`),

  deleteMessageForMe: (messageId, username) =>
    axios.post(`${API_BASE_URL}/chat/messages/delete-for-me`, { messageId, username })
};

export const notificationAPI = {
  sendNotification: (receiverId, title, body) =>
    axios.post(`${API_BASE_URL}/notifications/send`, { receiverId, title, body }),

  sendNotificationByUsername: (receiverUsername, sendersUsername, messageText) =>
    axios.post(`${API_BASE_URL}/notifications/send-by-username`, {
      receiverUsername,
      sendersUsername,
      messageText
    })
};
