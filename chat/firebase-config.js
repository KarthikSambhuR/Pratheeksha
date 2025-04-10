const firebaseConfig = {
    apiKey: "XXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "XXXXXXXXXXXXXXXXXXXXXXXX.firebaseapp.com",
    projectId: "XXXXXXXXXXXXXXXXXXXXXXXX-web",
    databaseURL: "https://XXXXXXXXXXXXXXXXXXXXXXXX.asia-southeast1.firebasedatabase.app",
    storageBucket: "XXXXXXXXXXXXXXXXXXXXXXXX-web.appspot.com",
    messagingSenderId: "XXXXXXXXXXXXXXXXXXXXXXXX",
    appId: "1:XXXXXXXXXXXXXXXXXXXXXXXX:web:434b2ba0d5e9de4519c914",
    measurementId: "G-XXXXXXXXXXXXXXXXXXXXXXXX"
};
  
  const app = firebase.initializeApp(firebaseConfig);
  const db = firebase.database(); 
  const serverTimestamp = firebase.database.ServerValue.TIMESTAMP; 