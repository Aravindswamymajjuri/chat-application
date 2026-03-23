const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
let serviceAccount = null;

try {
  // Priority 1: Environment variable with base64-encoded credentials (for Render, Vercel, etc.)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const decodedCredentials = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    serviceAccount = JSON.parse(decodedCredentials);
    console.log('✅ Firebase credentials loaded from FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable');
  }
  // Priority 2: Environment variable with file path
  else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = require(serviceAccountPath);
      console.log('✅ Firebase credentials loaded from FIREBASE_SERVICE_ACCOUNT_PATH');
    }
  }
  // Priority 3: Local file (for local development)
  else {
    const localPath = path.join(__dirname, '../firebaseServiceAccount.json');
    if (fs.existsSync(localPath)) {
      serviceAccount = require(localPath);
      console.log('✅ Firebase credentials loaded from local firebaseServiceAccount.json');
    }
  }

  if (!serviceAccount) {
    throw new Error('No Firebase service account credentials found');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.warn('\n⚠️  Firebase Admin initialization warning:');
  console.warn(`Error: ${error.message}\n`);
  console.warn('📋 To configure Firebase credentials:\n');
  console.warn('LOCAL DEVELOPMENT:');
  console.warn('  1. Download firebaseServiceAccount.json from Firebase Console');
  console.warn('  2. Save it in the backend folder\n');
  console.warn('RENDER/DEPLOYMENT:');
  console.warn('  1. Get your firebaseServiceAccount.json from Firebase Console');
  console.warn('  2. Encode it as base64: cat firebaseServiceAccount.json | base64');
  console.warn('  3. Add FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable in Render dashboard');
  console.warn('  4. Restart your service\n');
  console.warn('Push notifications will not work without proper Firebase credentials\n');
}

module.exports = admin;
