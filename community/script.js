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

function simpleHashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; 
    }
    return Math.abs(hash);
}

function getColorForUserId(userId) {
    if (!userId) return 'hsl(0, 0%, 70%)'; 
    const hash = simpleHashCode(userId);
    const hue = hash % 360; 
    const saturation = 60 + (hash % 15); 
    const lightness = 55 + (hash % 15); 
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function getContrastColor(bgColor) {
    try {
        const match = bgColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (match && match[3]) {
            const lightness = parseInt(match[3], 10);
            return lightness > 60 ? 'var(--dark-text)' : 'var(--light-text)';
        }
    } catch (e) {
        console.warn("Could not parse HSL color for contrast:", bgColor, e);
    }
    return 'var(--light-text)'; 
}

function getInitialForUserId(userId) {
    if (!userId) return '?';
    const hash = simpleHashCode(userId);
    return String.fromCharCode(65 + (hash % 26)); 
}

try {

    const app = firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    const auth = firebase.auth(); 
    const serverTimestamp = firebase.database.ServerValue.TIMESTAMP;

    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const initialStatus = document.getElementById('initialStatus');

    let currentUserId = null; 

    auth.onAuthStateChanged(user => {
        if (user) {

            currentUserId = user.uid;
            console.log("Authenticated anonymously. User ID:", currentUserId);

            if (initialStatus) {
                initialStatus.textContent = `Welcome! Messages older than ~24 hours may be periodically cleared. Be respectful.`;

            }

            messageInput.disabled = false;
            sendButton.disabled = true; 
            checkInput(); 
            messageInput.placeholder = "Type your message...";

            initializeChatListeners();

            setTimeout(scrollToBottom, 500); 

        } else {

            console.log("User not signed in. Attempting anonymous sign-in...");
            if(initialStatus) initialStatus.textContent = "Authenticating..."; 
            messageInput.placeholder = "Authenticating...";
            messageInput.disabled = true;
            sendButton.disabled = true;
            auth.signInAnonymously().catch(error => {
                console.error("Anonymous sign-in failed:", error);
                displayStatusMessage(`Authentication failed: ${error.message}. Please refresh.`, true);
                 if(initialStatus) initialStatus.style.display = 'none'; 
            });
        }
    });

    const messagesRef = db.ref('/groupchat/messages');

    function initializeChatListeners() {
        messagesRef.limitToLast(50).off(); 

        messagesRef.limitToLast(50).on('child_added', (snapshot) => {

            if (!document.querySelector(`[data-message-id="${snapshot.key}"]`)) {
                 displayMessage(snapshot.key, snapshot.val());
            }
        }, (error) => {
             console.error("Error listening for messages:", error);
             displayStatusMessage("Error receiving messages. Connection might be lost.", true);
        });
    }

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

        const userColor = getColorForUserId(messageData.userId);
        const contrastColor = getContrastColor(userColor);
        const userInitial = getInitialForUserId(messageData.userId);

        avatar.textContent = userInitial;
        avatar.style.backgroundColor = userColor;
        avatar.style.color = contrastColor;

        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble');

        const messageText = document.createElement('p');
        messageText.textContent = messageData.text; 
        messageBubble.appendChild(messageText);

        if (messageData.userId === currentUserId) {
            messageContainer.classList.add('user-message');
        } else {
            messageContainer.classList.add('mentor-message'); 
        }

        messageContainer.appendChild(avatar);
        messageContainer.appendChild(messageBubble);

        chatMessages.appendChild(messageContainer); 

        scrollToBottom(); 
    }

    function scrollToBottom() {

        setTimeout(() => {

            if (chatMessages) { 
                 chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }, 50); 
    }

    function sendMessage() {
        if (!currentUserId) {
            displayStatusMessage("Cannot send message: Not authenticated.", true);
            return;
        }

        const messageText = messageInput.value.trim();

        if (messageText) {
            const messageData = {
                userId: currentUserId, 
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

        document.querySelectorAll('.status-message.temporary').forEach(el => el.remove());

        let statusDiv = document.getElementById('initialStatus');
        if (statusDiv && (statusDiv.textContent.includes("Connecting") || statusDiv.textContent.includes("Authenticating"))) {

             statusDiv.textContent = message;
             statusDiv.className = 'status-message'; 
             statusDiv.classList.toggle('error', isError);
             statusDiv.style.backgroundColor = isError ? 'rgba(200, 0, 0, 0.8)' : 'rgba(90, 90, 90, 0.6)';
        } else {

            statusDiv = document.createElement('div');
            statusDiv.classList.add('status-message', 'temporary'); 
            statusDiv.classList.toggle('error', isError);
            statusDiv.style.backgroundColor = isError ? 'rgba(200, 0, 0, 0.8)' : 'rgba(90, 90, 90, 0.6)';
            statusDiv.textContent = message;
            chatMessages.appendChild(statusDiv);
        }
        scrollToBottom();
    }

    function checkInput() {
        const messageText = messageInput.value.trim();
        sendButton.disabled = !currentUserId || !messageText;
    }

    sendButton.addEventListener('click', sendMessage);

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            sendMessage();
        }
    });

    messageInput.addEventListener('input', checkInput); 

    checkInput(); 

} catch (error) {
    console.error("Firebase initialization or critical error:", error);
    const chatArea = document.getElementById('chatMessages');
    const statusDivId = 'initialStatus'; 
    let statusDiv = document.getElementById(statusDivId);

    if (!statusDiv && chatArea) { 
        statusDiv = document.createElement('div');
        statusDiv.id = statusDivId;
        statusDiv.classList.add('status-message');
        chatArea.insertBefore(statusDiv, chatArea.firstChild); 
    }

    if(statusDiv) { 
        statusDiv.textContent = `Critical Error: Could not initialize chat service. ${error.message}`;
        statusDiv.classList.add('error');
        statusDiv.style.backgroundColor = 'rgba(200, 0, 0, 0.8)';
    } else { 
        alert(`Fatal Error: Could not initialize chat service. ${error.message}`);
    }

     const msgInput = document.getElementById('messageInput');
     const sndButton = document.getElementById('sendButton');
     if(msgInput) {
         msgInput.disabled = true;
         msgInput.placeholder = "Chat unavailable";
     }
     if(sndButton) sndButton.disabled = true;
}