const firebaseConfig = {
    apiKey: "AIzaSyB_1LndigtBkR3gO3E5GQIbEvKsGfUN7TQ",
    authDomain: "pratheeksha-web.firebaseapp.com",
    projectId: "pratheeksha-web",
    databaseURL: "https://pratheeksha-web-default-rtdb.asia-southeast1.firebasedatabase.app", // Make sure this is correct!
    storageBucket: "pratheeksha-web.firebasestorage.app",
    messagingSenderId: "444143241341",
    appId: "1:444143241341:web:434b2ba0d5e9de4519c914",
    measurementId: "G-SF8911EQT0"
};
  
  // Initialize Firebase
  const app = firebase.initializeApp(firebaseConfig);
  const db = firebase.database(); // Use the V8 compatibility library for simplicity here
  const serverTimestamp = firebase.database.ServerValue.TIMESTAMP; // Convenience reference