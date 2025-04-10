const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const chatContainer = document.querySelector('.chat-container');
const statusMessageDiv = document.getElementById('statusMessage');

let chatId = null;
let chatRef = null;
let messagesRef = null;
let metadataRef = null;
let statusListenerRef = null; 
let messagesListenerRef = null; 
let noMentorTimeout = null; 
let mentorsPresenceRef = null; 
let presenceListenerRef = null; 

const NO_MENTOR_TIMEOUT_MS = 45000; 
const NO_MENTOR_PHONE = "+91 14446"; 

function generateChatId() {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 9);
    return `chat_${timestamp}_${randomPart}`;
}

function showStatusMessage(message, isError = false) {
    statusMessageDiv.textContent = message;
    statusMessageDiv.style.backgroundColor = isError ? 'rgba(200, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)'; 
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
    } else { 
        messageContainer.classList.add('mentor-message'); 
         if (sender === 'mentor') {
             avatar.classList.add('mentor-avatar');
             avatar.textContent = 'A';
              messageBubble.style.backgroundColor = 'var(--mentor-message-bg)';
         } else { 
             avatar.classList.add('system-avatar'); 
             avatar.textContent = 'S';
              messageBubble.style.backgroundColor = '#e0e0e0'; 
         }
        messageContainer.appendChild(avatar);
        messageContainer.appendChild(messageBubble);
    }

    const firstChild = chatMessages.firstChild;
    if (firstChild && firstChild.id === 'statusMessage') {
         chatMessages.insertBefore(messageContainer, firstChild.nextSibling); 
    } else if (statusMessageDiv && statusMessageDiv.parentNode === chatMessages) {
        chatMessages.insertBefore(messageContainer, statusMessageDiv);
    }
     else {
        chatMessages.appendChild(messageContainer);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '' || !messagesRef || !metadataRef) return;

    const message = {
        sender: 'user',
        text: text,
        timestamp: serverTimestamp 
    };

    metadataRef.child('status').get().then(snap => {
        const status = snap.val();
        if (status === 'active' || status === 'pending') {
            messagesRef.push(message)
                .then(() => {

                    metadataRef.update({ lastMessageAt: serverTimestamp });
                    messageInput.value = ''; 
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

function proceedWithChatInitialization(initialStatus = 'pending') {
    console.log("Proceeding with chat initialization, status:", initialStatus);

    metadataRef.set({
        createdAt: serverTimestamp,
        status: initialStatus, 
        lastMessageAt: serverTimestamp
    }).then(() => {
        console.log("Chat created in Firebase with ID:", chatId, "Status:", initialStatus);

        if (initialStatus === 'pending') {
             showStatusMessage("Waiting for a mentor to join...");

             startNoMentorTimeout();

             messageInput.disabled = false;
             sendButton.disabled = false;
             messageInput.focus();
        }

        listenForStatusChanges();

        listenForMessages();

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
    clearTimeout(noMentorTimeout); 
    console.log("Starting no-mentor timeout:", NO_MENTOR_TIMEOUT_MS);
    noMentorTimeout = setTimeout(() => {
         if(metadataRef) {
            metadataRef.child('status').get().then(snapshot => {
                if (snapshot.val() === 'pending') {
                    console.log("No mentor picked up within timeout.");
                    showStatusMessage(`No mentor available to take this chat right now. Please call ${NO_MENTOR_PHONE}.`, true);
                    messageInput.disabled = true;
                    sendButton.disabled = true;

                    metadataRef.update({ status: 'closed', closedReason: 'timeout' });
                }
            });
         }
    }, NO_MENTOR_TIMEOUT_MS);
}

function listenForStatusChanges() {
    if (statusListenerRef) statusListenerRef.off(); 
    statusListenerRef = metadataRef.child('status');
    statusListenerRef.on('value', (snapshot) => {
        const status = snapshot.val();
        console.log("Chat status changed:", status);

        switch(status) {
            case 'active':
                hideStatusMessage();
                clearTimeout(noMentorTimeout); 
                messageInput.disabled = false;
                sendButton.disabled = false;

                if (document.activeElement !== messageInput) {
                    messageInput.focus();
                }
                break;
            case 'pending':

                showStatusMessage("Waiting for a mentor to join...");
                startNoMentorTimeout(); 
                messageInput.disabled = false; 
                sendButton.disabled = false;
                break;
            case 'closed':
                clearTimeout(noMentorTimeout);

                 metadataRef.child('closedReason').get().then(reasonSnap => {
                    if (reasonSnap.val() !== 'timeout') {
                         showStatusMessage("This chat has been closed.", true);
                    }
                 });
                messageInput.disabled = true;
                sendButton.disabled = true;
                detachFirebaseListeners(); 
                break;
            case 'unattended': 
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
    if (messagesListenerRef) messagesListenerRef.off(); 
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

        mentorsPresenceRef.once('value', (snapshot) => {
            const areMentorsPresent = snapshot.exists() && snapshot.hasChildren();
            console.log("Initial mentor presence check:", areMentorsPresent);

            if (areMentorsPresent) {

                 proceedWithChatInitialization('pending');

                 listenForPresenceChanges();
            } else {

                showStatusMessage(`No mentors available at the moment. Please call ${NO_MENTOR_PHONE}.`, true);
                messageInput.disabled = true;
                sendButton.disabled = true;

                metadataRef.set({
                    createdAt: serverTimestamp,
                    status: 'unattended',
                    lastMessageAt: serverTimestamp
                }).catch(err => console.error("Error setting unattended status:", err));

                 listenForPresenceChanges();
            }
        }, (error) => {
            console.error("Error checking mentor presence:", error);
            showStatusMessage("Error checking mentor availability. Please try again.", true);
             messageInput.disabled = true;
             sendButton.disabled = true;
        });

    } catch (error) {
        console.error("Firebase setup error:", error);
        showStatusMessage("Error setting up chat. Unsupported browser or configuration issue.", true);
        messageInput.disabled = true;
        sendButton.disabled = true;
    }

    window.addEventListener('beforeunload', () => {
        clearTimeout(noMentorTimeout);
        detachFirebaseListeners();

        if (metadataRef) {
            metadataRef.update({ status: 'closed', closedReason: 'userLeft' });
        }
    });
}

function listenForPresenceChanges() {
    if (presenceListenerRef) presenceListenerRef.off(); 

    presenceListenerRef = mentorsPresenceRef;
    presenceListenerRef.on('value', (snapshot) => {
        const areMentorsPresent = snapshot.exists() && snapshot.hasChildren();
        console.log("Mentor presence changed:", areMentorsPresent);

         if(!metadataRef) return; 

         metadataRef.child('status').get().then(statusSnapshot => {
            const currentStatus = statusSnapshot.val();

            if (!areMentorsPresent && currentStatus === 'pending') {

                console.log("Mentors went offline while status was pending.");
                showStatusMessage(`All mentors have gone offline. Please call ${NO_MENTOR_PHONE}.`, true);
                clearTimeout(noMentorTimeout);
                messageInput.disabled = true;
                sendButton.disabled = true;

                metadataRef.update({ status: 'unattended' });
            }

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
    if (presenceListenerRef) { 
        presenceListenerRef.off();
        presenceListenerRef = null;
    }
    clearTimeout(noMentorTimeout); 
}

window.addEventListener('load', initChat);