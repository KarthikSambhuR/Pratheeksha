const firebaseConfig = {
    apiKey: "AIzaSyB_1LndigtBkR3gO3E5GQIbEvKsGfUN7TQ",
    authDomain: "pratheeksha-web.firebaseapp.com",
    projectId: "pratheeksha-web",
    databaseURL: "https://pratheeksha-web-default-rtdb.asia-southeast1.firebasedatabase.app", 
    storageBucket: "pratheeksha-web.firebasestorage.app",
    messagingSenderId: "444143241341",
    appId: "1:444143241341:web:434b2ba0d5e9de4519c914",
    measurementId: "G-SF8911EQT0"
};
  
  const app = firebase.initializeApp(firebaseConfig);
  const db = firebase.database(); 
  const serverTimestamp = firebase.database.ServerValue.TIMESTAMP; 