// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCK3qViGuH5lKCYf9e2zDEZ-1qNHLc_7Yg",
  authDomain: "review-nfc-4936a.firebaseapp.com",
  projectId: "review-nfc-4936a",
  storageBucket: "review-nfc-4936a.firebasestorage.app",
  messagingSenderId: "171312532220",
  appId: "1:171312532220:web:5be0fdd4068f01513a2579",
  measurementId: "G-093P9DLYB9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);