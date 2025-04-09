// Firebase Configuration (Paste your actual config here)
const firebaseConfig = {
    apiKey: "AIzaSyB_1LndigtBkR3gO3E5GQIbEvKsGfUN7TQ",
    authDomain: "pratheeksha-web.firebaseapp.com",
    projectId: "pratheeksha-web",
    databaseURL: "https://pratheeksha-web-default-rtdb.asia-southeast1.firebasedatabase.app",
    storageBucket: "pratheeksha-web.appspot.com", // Corrected bucket name? Check your config
    messagingSenderId: "444143241341",
    appId: "1:444143241341:web:434b2ba0d5e9de4519c914",
    measurementId: "G-SF8911EQT0"
};

// Initialize Firebase
try {
    const app = firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    const serverTimestamp = firebase.database.ServerValue.TIMESTAMP;

    // --- DOM Elements ---
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');

    // --- Temporary User ID ---
    // Generate a simple random ID for this session
    let userId = sessionStorage.getItem('groupChatUserId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('groupChatUserId', userId);
    }
    console.log("Your temporary User ID:", userId);

    // --- Firebase Database Reference ---
    const messagesRef = db.ref('/groupchat/messages');

    // --- Functions ---

    // Function to display a message
    function displayMessage(key, messageData) {
        if (!messageData || !messageData.text || !messageData.userId) {
            console.warn("Skipping invalid message:", key, messageData);
            return; // Don't display incomplete messages
        }

        const messageContainer = document.createElement('div');
        messageContainer.classList.add('message-container');
        messageContainer.dataset.messageId = key; // Store key for potential future use

        const avatar = document.createElement('div');
        avatar.classList.add('avatar');
        avatar.textContent = messageData.userId.substring(0, 1) || '?'; // First letter of ID

        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble');

        const messageText = document.createElement('p');
        messageText.textContent = messageData.text; // Basic text display
        messageBubble.appendChild(messageText);

        // Style based on whether the message is from the current user
        if (messageData.userId === userId) {
            messageContainer.classList.add('user-message'); // Align right
            avatar.classList.add('user-avatar'); // Grey avatar
        } else {
            messageContainer.classList.add('mentor-message'); // Align left (using mentor style)
            avatar.classList.add('mentor-avatar'); // Green avatar
        }

        messageContainer.appendChild(avatar);
        messageContainer.appendChild(messageBubble);

        chatMessages.appendChild(messageContainer);

        // Scroll to bottom
        scrollToBottom();
    }

    // Function to scroll chat to the bottom
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Function to send a message
    function sendMessage() {
        const messageText = messageInput.value.trim();

        if (messageText) {
            const messageData = {
                userId: userId,
                text: messageText,
                timestamp: serverTimestamp // Use Firebase server timestamp
            };

            // Disable input/button while sending
            messageInput.disabled = true;
            sendButton.disabled = true;

            messagesRef.push(messageData)
                .then(() => {
                    messageInput.value = ''; // Clear input on success
                    // Re-enable input/button
                    messageInput.disabled = false;
                    sendButton.disabled = false; // Will be re-disabled by input check if empty
                    messageInput.focus();
                    checkInput(); // Update button state
                })
                .catch((error) => {
                    console.error("Error sending message: ", error);
                    displayStatusMessage("Error sending message. Please try again.", true);
                     // Re-enable input/button even on error
                    messageInput.disabled = false;
                    sendButton.disabled = false;
                    checkInput(); // Update button state
                });
        }
    }

    // Function to display temporary status messages (like errors)
    function displayStatusMessage(message, isError = false) {
        const statusDiv = document.createElement('div');
        statusDiv.classList.add('status-message');
        if (isError) {
            statusDiv.classList.add('error'); // Add error class for styling
             statusDiv.style.backgroundColor = 'rgb(200, 0, 0)'; // Inline style for emphasis
        }
        statusDiv.textContent = message;
        chatMessages.appendChild(statusDiv);
        scrollToBottom();

        // Optional: Remove status message after a few seconds
        // setTimeout(() => {
        //     if (chatMessages.contains(statusDiv)) {
        //         chatMessages.removeChild(statusDiv);
        //     }
        // }, 5000);
    }


     // Function to enable/disable send button based on input content
    function checkInput() {
        const messageText = messageInput.value.trim();
        sendButton.disabled = !messageText; // Disable if empty, enable if not
    }


    // --- Event Listeners ---

    // Send on button click
    sendButton.addEventListener('click', sendMessage);

    // Send on Enter key press in input field
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, allow Shift+Enter for newline (though input is single line)
            e.preventDefault(); // Prevent default form submission/newline
            sendMessage();
        }
    });

     // Check input on keyup to enable/disable send button
    messageInput.addEventListener('keyup', checkInput);
    // Also check initially in case of page reload with text
    checkInput();


    // --- Firebase Listener ---
    // Listen for new messages added to the '/groupchat/messages' path
    // Use limitToLast to fetch only recent messages on initial load & prevent overload
    messagesRef.limitToLast(50).on('child_added', (snapshot) => {
        displayMessage(snapshot.key, snapshot.val());
    });

    // Optional: Listen for changes (edits - less common in chat)
    // messagesRef.on('child_changed', (snapshot) => {
    //     console.log("Message changed:", snapshot.key, snapshot.val());
    //     // Find and update the message element in the DOM (more complex)
    // });

    // Optional: Listen for deletions (less common in chat)
    // messagesRef.on('child_removed', (snapshot) => {
    //     console.log("Message removed:", snapshot.key);
    //     const messageElement = chatMessages.querySelector(`[data-message-id="${snapshot.key}"]`);
    //     if (messageElement) {
    //         messageElement.remove();
    //     }
    // });

     // Initial scroll to bottom after a short delay to allow rendering
     setTimeout(scrollToBottom, 500);

} catch (error) {
    console.error("Firebase initialization failed:", error);
    // Display error to user in the chat area if elements exist
    const chatArea = document.getElementById('chatMessages');
    if (chatArea) {
        chatArea.innerHTML = `<div class="status-message error">Could not connect to chat service. Please check your connection and Firebase configuration.</div>`;
    } else {
        alert("Fatal Error: Could not initialize chat service.");
    }
     // Disable input if init fails
     const msgInput = document.getElementById('messageInput');
     const sndButton = document.getElementById('sendButton');
     if(msgInput) msgInput.disabled = true;
     if(sndButton) sndButton.disabled = true;

}