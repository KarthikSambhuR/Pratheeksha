const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const chatContainer = document.querySelector('.chat-container');
const statusMessageDiv = document.getElementById('statusMessage');

let chatId = null;
let chatRef = null;
let messagesRef = null;
let metadataRef = null;
let statusListenerRef = null; // To detach listener later
let messagesListenerRef = null; // To detach listener later
let noMentorTimeout = null; // Timer for the "no mentor" message if they were initially present
let mentorsPresenceRef = null; // Ref to check mentor presence
let presenceListenerRef = null; // Ref to detach presence listener

const NO_MENTOR_TIMEOUT_MS = 45000; // 45 seconds (adjust as needed)
const NO_MENTOR_PHONE = "1-800-EXAMPLE"; // Replace with actual number

function generateChatId() {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 9);
    return `chat_${timestamp}_${randomPart}`;
}

function showStatusMessage(message, isError = false) {
    statusMessageDiv.textContent = message;
    statusMessageDiv.style.backgroundColor = isError ? 'rgba(200, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)'; // Darker red for error
    statusMessageDiv.style.display = 'block';
}

function hideStatusMessage() {
    statusMessageDiv.style.display = 'none';
}

function displayMessage(text, sender) {
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message-container');

    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble');

    const messageText = document.createElement('p');
    messageText.textContent = text;
    messageBubble.appendChild(messageText);

    const avatar = document.createElement('div');
    avatar.classList.add('avatar');

    if (sender === 'user') {
        messageContainer.classList.add('user-message');
        avatar.classList.add('user-avatar');
        avatar.textContent = 'U';
        messageBubble.style.backgroundColor = 'var(--user-message-bg)';
        messageContainer.appendChild(messageBubble);
        messageContainer.appendChild(avatar);
    } else { // mentor or system
        messageContainer.classList.add('mentor-message'); // Left aligned
         if (sender === 'mentor') {
             avatar.classList.add('mentor-avatar');
             avatar.textContent = 'A';
              messageBubble.style.backgroundColor = 'var(--mentor-message-bg)';
         } else { // System message
             avatar.classList.add('system-avatar'); // Style if needed (e.g., different color/icon)
             avatar.textContent = 'S';
              messageBubble.style.backgroundColor = '#e0e0e0'; // Grey for system
         }
        messageContainer.appendChild(avatar);
        messageContainer.appendChild(messageBubble);
    }

    // Insert before status message if it exists, otherwise append
    const firstChild = chatMessages.firstChild;
    if (firstChild && firstChild.id === 'statusMessage') {
         chatMessages.insertBefore(messageContainer, firstChild.nextSibling); // Insert after status
    } else if (statusMessageDiv && statusMessageDiv.parentNode === chatMessages) {
        chatMessages.insertBefore(messageContainer, statusMessageDiv);
    }
     else {
        chatMessages.appendChild(messageContainer);
    }

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '' || !messagesRef || !metadataRef) return;

    const message = {
        sender: 'user',
        text: text,
        timestamp: serverTimestamp // Use Firebase server timestamp
    };

    // Ensure chat status allows sending (should be active or pending initially)
    metadataRef.child('status').get().then(snap => {
        const status = snap.val();
        if (status === 'active' || status === 'pending') {
            messagesRef.push(message)
                .then(() => {
                    // Update last message timestamp in metadata
                    metadataRef.update({ lastMessageAt: serverTimestamp });
                    messageInput.value = ''; // Clear input on success
                })
                .catch(error => {
                    console.error("Error sending message:", error);
                    showStatusMessage("Error sending message. Please try again.", true);
                });
        } else {
             console.log("Cannot send message, chat status is:", status);
             showStatusMessage("Cannot send message, the chat is closed.", true);
        }
    }).catch(error => {
         console.error("Error checking status before sending:", error);
         showStatusMessage("Error sending message. Please try again.", true);
    });

}

// Function to start the chat logic AFTER confirming mentor presence
function proceedWithChatInitialization(initialStatus = 'pending') {
    console.log("Proceeding with chat initialization, status:", initialStatus);
    // 1. Create chat metadata in Firebase
    metadataRef.set({
        createdAt: serverTimestamp,
        status: initialStatus, // Set based on mentor presence check
        lastMessageAt: serverTimestamp
    }).then(() => {
        console.log("Chat created in Firebase with ID:", chatId, "Status:", initialStatus);

        if (initialStatus === 'pending') {
             showStatusMessage("Waiting for a mentor to join...");
             // Start the timeout ONLY if mentors were present initially
             startNoMentorTimeout();
             // Enable input now as we expect a mentor
             messageInput.disabled = false;
             sendButton.disabled = false;
             messageInput.focus();
        }
        // If status was 'unattended', message stays "No mentors..." and input remains disabled

        // 2. Listen for status changes (e.g., mentor joining makes it 'active')
        listenForStatusChanges();

        // 3. Listen for new messages
        listenForMessages();

        // 4. Enable input/send button listeners (already done partially above)
        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

    }).catch(error => {
        console.error("Firebase metadata creation error:", error);
        showStatusMessage("Error creating chat session. Please try again later.", true);
        messageInput.disabled = true;
        sendButton.disabled = true;
    });
}

function startNoMentorTimeout() {
    clearTimeout(noMentorTimeout); // Clear any existing timeout
    console.log("Starting no-mentor timeout:", NO_MENTOR_TIMEOUT_MS);
    noMentorTimeout = setTimeout(() => {
         if(metadataRef) {
            metadataRef.child('status').get().then(snapshot => {
                if (snapshot.val() === 'pending') {
                    console.log("No mentor picked up within timeout.");
                    showStatusMessage(`No mentor available to take this chat right now. Please call ${NO_MENTOR_PHONE}.`, true);
                    messageInput.disabled = true;
                    sendButton.disabled = true;
                    // Close the chat in Firebase as unattended after timeout
                    metadataRef.update({ status: 'closed', closedReason: 'timeout' });
                }
            });
         }
    }, NO_MENTOR_TIMEOUT_MS);
}

function listenForStatusChanges() {
    if (statusListenerRef) statusListenerRef.off(); // Remove previous listener if any
    statusListenerRef = metadataRef.child('status');
    statusListenerRef.on('value', (snapshot) => {
        const status = snapshot.val();
        console.log("Chat status changed:", status);

        switch(status) {
            case 'active':
                hideStatusMessage();
                clearTimeout(noMentorTimeout); // Mentor joined, cancel the timeout
                messageInput.disabled = false;
                sendButton.disabled = false;
                // Don't refocus if user is typing
                if (document.activeElement !== messageInput) {
                    messageInput.focus();
                }
                break;
            case 'pending':
                // This might happen if it was 'unattended' and a mentor came online
                // Or just the initial state
                showStatusMessage("Waiting for a mentor to join...");
                startNoMentorTimeout(); // Restart timeout if needed
                messageInput.disabled = false; // Should be enabled if pending
                sendButton.disabled = false;
                break;
            case 'closed':
                clearTimeout(noMentorTimeout);
                // Check if the reason was timeout to avoid overwriting that specific message
                 metadataRef.child('closedReason').get().then(reasonSnap => {
                    if (reasonSnap.val() !== 'timeout') {
                         showStatusMessage("This chat has been closed.", true);
                    }
                 });
                messageInput.disabled = true;
                sendButton.disabled = true;
                detachFirebaseListeners(); // Stop listening once closed
                break;
            case 'unattended': // Handle case where mentors leave while user waits
                 showStatusMessage(`No mentors available at the moment. Please call ${NO_MENTOR_PHONE}.`, true);
                 clearTimeout(noMentorTimeout);
                 messageInput.disabled = true;
                 sendButton.disabled = true;
                 break;
            default:
                console.warn("Unknown chat status received:", status);
        }
    });
}

function listenForMessages() {
    if (messagesListenerRef) messagesListenerRef.off(); // Remove previous listener
    messagesListenerRef = messagesRef.orderByChild('timestamp');
    messagesListenerRef.on('child_added', (snapshot) => {
        const msg = snapshot.val();
        if (msg) {
            displayMessage(msg.text, msg.sender);
        }
    });
}

function initChat() {
    showStatusMessage("Connecting and checking mentor availability...");
    chatId = generateChatId();
    document.title = `Chat #${chatId.substring(5, 15)}`;

    try {
        chatRef = db.ref('chats/' + chatId);
        messagesRef = chatRef.child('messages');
        metadataRef = chatRef.child('metadata');
        mentorsPresenceRef = db.ref('/presence/mentors');

        // --- Check Mentor Presence FIRST ---
        mentorsPresenceRef.once('value', (snapshot) => {
            const areMentorsPresent = snapshot.exists() && snapshot.hasChildren();
            console.log("Initial mentor presence check:", areMentorsPresent);

            if (areMentorsPresent) {
                // Mentors are online, proceed to create chat as 'pending'
                 proceedWithChatInitialization('pending');
                 // Start listening for mentors potentially going offline *while* waiting
                 listenForPresenceChanges();
            } else {
                // No mentors online right now
                showStatusMessage(`No mentors available at the moment. Please call ${NO_MENTOR_PHONE}.`, true);
                messageInput.disabled = true;
                sendButton.disabled = true;
                // Optional: Create chat record as 'unattended'
                metadataRef.set({
                    createdAt: serverTimestamp,
                    status: 'unattended',
                    lastMessageAt: serverTimestamp
                }).catch(err => console.error("Error setting unattended status:", err));
                 // Start listening for mentors potentially coming online
                 listenForPresenceChanges();
            }
        }, (error) => {
            console.error("Error checking mentor presence:", error);
            showStatusMessage("Error checking mentor availability. Please try again.", true);
             messageInput.disabled = true;
             sendButton.disabled = true;
        });
        // --- End Presence Check ---


    } catch (error) {
        console.error("Firebase setup error:", error);
        showStatusMessage("Error setting up chat. Unsupported browser or configuration issue.", true);
        messageInput.disabled = true;
        sendButton.disabled = true;
    }

    // Notify/update status on user leaving
    window.addEventListener('beforeunload', () => {
        clearTimeout(noMentorTimeout);
        detachFirebaseListeners();
    
        if (metadataRef) {
            metadataRef.update({ status: 'closed', closedReason: 'userLeft' });
        }
    });
}


function listenForPresenceChanges() {
    if (presenceListenerRef) presenceListenerRef.off(); // Detach previous listener

    presenceListenerRef = mentorsPresenceRef;
    presenceListenerRef.on('value', (snapshot) => {
        const areMentorsPresent = snapshot.exists() && snapshot.hasChildren();
        console.log("Mentor presence changed:", areMentorsPresent);

         // Check current chat status *before* reacting
         if(!metadataRef) return; // Don't react if chat hasn't been initialized

         metadataRef.child('status').get().then(statusSnapshot => {
            const currentStatus = statusSnapshot.val();

            if (!areMentorsPresent && currentStatus === 'pending') {
                // Mentors went offline while user was waiting
                console.log("Mentors went offline while status was pending.");
                showStatusMessage(`All mentors have gone offline. Please call ${NO_MENTOR_PHONE}.`, true);
                clearTimeout(noMentorTimeout);
                messageInput.disabled = true;
                sendButton.disabled = true;
                // Update status to unattended
                metadataRef.update({ status: 'unattended' });
            }
            // Potentially handle mentors coming back online if status was 'unattended'
            // else if (areMentorsPresent && currentStatus === 'unattended') {
            //    console.log("Mentors came back online while status was unattended.");
            //    showStatusMessage("Mentors are available again. Waiting for one to join...");
            //    metadataRef.update({ status: 'pending' }); // Set back to pending
            //    startNoMentorTimeout();
            //    // Should NOT enable input here, wait for status change to 'active'
            // }

         }).catch(err => console.error("Error checking status during presence change:", err));
    });
}

function detachFirebaseListeners() {
    console.log("Detaching Firebase listeners for chat:", chatId);
    if (statusListenerRef) {
        statusListenerRef.off();
        statusListenerRef = null;
    }
    if (messagesListenerRef) {
        messagesListenerRef.off();
        messagesListenerRef = null;
    }
    if (presenceListenerRef) { // Detach presence listener too
        presenceListenerRef.off();
        presenceListenerRef = null;
    }
    clearTimeout(noMentorTimeout); // Clear timer
}

// Start the chat initialization when the page loads
window.addEventListener('load', initChat);