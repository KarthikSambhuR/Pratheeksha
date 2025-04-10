const firebaseConfig = {
    apiKey: "AIzaSyB_1LndigtBkR3gO3E5GQIbEvKsGfUN7TQ",
    authDomain: "pratheeksha-web.firebaseapp.com",
    projectId: "pratheeksha-web",
    databaseURL: "https://pratheeksha-web-default-rtdb.asia-southeast1.firebasedatabase.app",
    storageBucket: "pratheeksha-web.appspot.com", 
    messagingSenderId: "444143241341",
    appId: "1:444143241341:web:434b2ba0d5e9de4519c914",
    measurementId: "G-SF8911EQT0"
};

try {
    const app = firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    const serverTimestamp = firebase.database.ServerValue.TIMESTAMP;

    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');

    let userId = sessionStorage.getItem('groupChatUserId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('groupChatUserId', userId);
    }
    console.log("Your temporary User ID:", userId);

    const messagesRef = db.ref('/groupchat/messages');

    function displayMessage(key, messageData) {
        if (!messageData || !messageData.text || !messageData.userId) {
            console.warn("Skipping invalid message:", key, messageData);
            return; 
        }

        const messageContainer = document.createElement('div');
        messageContainer.classList.add('message-container');
        messageContainer.dataset.messageId = key; 

        const avatar = document.createElement('div');
        avatar.classList.add('avatar');
        avatar.textContent = messageData.userId.substring(0, 1) || '?'; 

        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble');

        const messageText = document.createElement('p');
        messageText.textContent = messageData.text; 
        messageBubble.appendChild(messageText);

        if (messageData.userId === userId) {
            messageContainer.classList.add('user-message'); 
            avatar.classList.add('user-avatar'); 
        } else {
            messageContainer.classList.add('mentor-message'); 
            avatar.classList.add('mentor-avatar'); 
        }

        messageContainer.appendChild(avatar);
        messageContainer.appendChild(messageBubble);

        chatMessages.appendChild(messageContainer);

        scrollToBottom();
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function sendMessage() {
        const messageText = messageInput.value.trim();

        if (messageText) {
            const messageData = {
                userId: userId,
                text: messageText,
                timestamp: serverTimestamp 
            };

            messageInput.disabled = true;
            sendButton.disabled = true;

            messagesRef.push(messageData)
                .then(() => {
                    messageInput.value = ''; 

                    messageInput.disabled = false;
                    sendButton.disabled = false; 
                    messageInput.focus();
                    checkInput(); 
                })
                .catch((error) => {
                    console.error("Error sending message: ", error);
                    displayStatusMessage("Error sending message. Please try again.", true);

                    messageInput.disabled = false;
                    sendButton.disabled = false;
                    checkInput(); 
                });
        }
    }

    function displayStatusMessage(message, isError = false) {
        const statusDiv = document.createElement('div');
        statusDiv.classList.add('status-message');
        if (isError) {
            statusDiv.classList.add('error'); 
             statusDiv.style.backgroundColor = 'rgb(200, 0, 0)'; 
        }
        statusDiv.textContent = message;
        chatMessages.appendChild(statusDiv);
        scrollToBottom();

    }

    function checkInput() {
        const messageText = messageInput.value.trim();
        sendButton.disabled = !messageText; 
    }

    sendButton.addEventListener('click', sendMessage);

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            sendMessage();
        }
    });

    messageInput.addEventListener('keyup', checkInput);

    checkInput();

    messagesRef.limitToLast(50).on('child_added', (snapshot) => {
        displayMessage(snapshot.key, snapshot.val());
    });

     setTimeout(scrollToBottom, 500);

} catch (error) {
    console.error("Firebase initialization failed:", error);

    const chatArea = document.getElementById('chatMessages');
    if (chatArea) {
        chatArea.innerHTML = `<div class="status-message error">Could not connect to chat service. Please check your connection and Firebase configuration.</div>`;
    } else {
        alert("Fatal Error: Could not initialize chat service.");
    }

     const msgInput = document.getElementById('messageInput');
     const sndButton = document.getElementById('sendButton');
     if(msgInput) msgInput.disabled = true;
     if(sndButton) sndButton.disabled = true;

}