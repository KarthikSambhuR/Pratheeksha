const chatList = document.getElementById('chatList');
const chatDisplay = document.getElementById('chatDisplay');
const noChatSelectedDiv = document.getElementById('noChatSelected');

let chatsRef = null;
let activeChats = {}; 
let selectedChatId = null;

let currentChatMessagesDiv = null;
let currentMessageInput = null;
let currentSendButton = null;
let currentChatHeaderDiv = null;
let currentCloseChatButton = null; 
let currentMessagesListenerRef = null; 

let mentorPresenceId = null;
let mentorPresenceRef = null;
let connectedRef = null;

function generateMentorId() {
    return `mentor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function setupPresence() {
    mentorPresenceId = generateMentorId();
    mentorPresenceRef = db.ref('/presence/mentors/' + mentorPresenceId);
    connectedRef = db.ref('.info/connected');

    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            mentorPresenceRef.set(true)
                .then(() => {
                    console.log('Mentor presence set for ID:', mentorPresenceId);
                    mentorPresenceRef.onDisconnect().remove()
                        .then(() => console.log('onDisconnect handler set.'))
                        .catch(err => console.error('Error setting onDisconnect:', err));
                })
                .catch(err => console.error('Error setting initial presence:', err));
        } else {
             console.log('Mentor disconnected from Firebase.');
        }
    });
}

function removePresence() {
    if (mentorPresenceRef) {
        mentorPresenceRef.remove()
            .then(() => console.log('Mentor presence removed cleanly for ID:', mentorPresenceId))
            .catch(err => console.error('Error removing presence on unload:', err));
    }
     if(connectedRef) {
        connectedRef.off();
     }
}

function displayMessageInMentorView(text, sender, chatIdToDisplay) {

    if (!currentChatMessagesDiv || selectedChatId !== chatIdToDisplay) {
         console.log(`Message for ${chatIdToDisplay}, but ${selectedChatId} is selected.`);

         const listItem = activeChats[chatIdToDisplay]?.element;
         if (listItem && !listItem.classList.contains('active')) {
             const indicator = listItem.querySelector('.unread-indicator');
             if(indicator) indicator.style.display = 'inline-block'; 
         }
        return;
    }

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
        messageContainer.appendChild(messageBubble); 
        messageContainer.appendChild(avatar);
    } else { 
        messageContainer.classList.add('mentor-message'); 
        if (sender === 'mentor') {
             avatar.classList.add('mentor-avatar');
             avatar.textContent = 'A';
        } else { 
             avatar.classList.add('system-avatar'); 
             avatar.textContent = 'S';
              messageBubble.style.backgroundColor = '#e0e0e0'; 
              messageBubble.style.color = '#333';
        }
        messageContainer.appendChild(avatar); 
        messageContainer.appendChild(messageBubble);
    }

    currentChatMessagesDiv.appendChild(messageContainer);

    currentChatMessagesDiv.scrollTo({ top: currentChatMessagesDiv.scrollHeight, behavior: 'smooth' });
}

function sendMentorMessage() {
    if (!selectedChatId || !currentMessageInput || !db || currentMessageInput.disabled) return; 

    const text = currentMessageInput.value.trim();
    if (text === '') return;

    const currentChatRef = db.ref('chats/' + selectedChatId);
    const currentMessagesRef = currentChatRef.child('messages');
    const currentMetadataRef = currentChatRef.child('metadata');

    const message = {
        sender: 'mentor',
        text: text,
        timestamp: serverTimestamp
    };

    currentMessagesRef.push(message)
        .then(() => {

            currentMetadataRef.child('status').get().then(snapshot => {
                 const updates = { lastMessageAt: serverTimestamp };
                 if (snapshot.val() === 'pending') {
                     updates.status = 'active';
                 }
                 currentMetadataRef.update(updates);
            });

            currentMessageInput.value = ''; 

        })
        .catch(error => {
            console.error("Error sending mentor message:", error);

            displayMessageInMentorView(`Error: ${error.message}`, 'system', selectedChatId);
        });
}

function closeChatByMentor(chatId) {
    if (!chatId || chatId !== selectedChatId) {
        console.warn("Attempted to close chat with mismatching ID:", chatId, selectedChatId);
        return;
    }

    if (!confirm(`Are you sure you want to close chat #${chatId.substring(5, 15)}?`)) {
        return;
    }

    console.log("Mentor closing chat:", chatId);
    const chatMetadataRef = db.ref('chats/' + chatId + '/metadata');

    if (currentCloseChatButton) {
        currentCloseChatButton.disabled = true;
        currentCloseChatButton.title = "Closing...";
    }

    if (currentMessageInput) currentMessageInput.disabled = true;
    if (currentSendButton) currentSendButton.disabled = true;

    chatMetadataRef.update({
        status: 'closed',
        closedReason: 'closedByMentor' 
    })
    .then(() => {
        console.log("Chat status updated to closed by mentor:", chatId);

        displayMessageInMentorView("Chat closed by mentor.", "system", chatId);
    })
    .catch(error => {
        console.error("Error closing chat:", error);

        if (currentCloseChatButton) {
             currentCloseChatButton.disabled = false; 
             currentCloseChatButton.title = "Close Chat";
        }
         if (currentMessageInput) currentMessageInput.disabled = false; 
         if (currentSendButton) currentSendButton.disabled = false;

        displayMessageInMentorView(`Error closing chat: ${error.message}`, 'system', chatId);
    });
}

function selectChat(chatId) {
    if (selectedChatId === chatId) return; 

    if (selectedChatId && activeChats[selectedChatId]) {
        activeChats[selectedChatId].element.classList.remove('active');

        if (currentMessagesListenerRef) {
            currentMessagesListenerRef.off(); 
             console.log(`Detached message listener for ${selectedChatId}`);
        }
        currentMessagesListenerRef = null; 
    }

    selectedChatId = chatId;
    const chatInfo = activeChats[chatId];

    chatDisplay.innerHTML = '';
    const noChatDiv = document.getElementById('noChatSelected');
    if (noChatDiv) noChatDiv.style.display = 'none';

    if (!chatInfo || !chatInfo.metadata) { 
        console.error("Selected chat info or metadata not found:", chatId);
        showNoChatSelected(); 
        return;
    }

    chatInfo.element.classList.add('active');
    const indicator = chatInfo.element.querySelector('.unread-indicator');
    if(indicator) indicator.style.display = 'none'; 

    currentChatHeaderDiv = document.createElement('header');
    currentChatHeaderDiv.className = 'chat-header';
    const chatStatus = chatInfo.metadata.status || 'unknown'; 
    const statusText = ` (${chatStatus})`;

    currentCloseChatButton = document.createElement('button');
    currentCloseChatButton.innerHTML = '×'; 
    currentCloseChatButton.className = 'close-chat-button';
    currentCloseChatButton.title = 'Close Chat';

    currentCloseChatButton.addEventListener('click', () => closeChatByMentor(chatId));

    const isClosed = (chatStatus === 'closed');
    if (isClosed) {
        currentCloseChatButton.disabled = true;
        currentCloseChatButton.style.display = 'none'; 
    }

    currentChatHeaderDiv.innerHTML = `
        <div class="avatar user-avatar-header">U</div> <!-- User on left -->
        <div class="chat-with">User #${chatId.substring(5, 15)}${statusText}</div>
        <div class="header-icons">
             <!-- Close button will be appended here -->
             <div class="avatar mentor-avatar-header">A</div> <!-- Mentor on right -->
        </div>`;

    currentChatHeaderDiv.querySelector('.header-icons').prepend(currentCloseChatButton); 
    chatDisplay.appendChild(currentChatHeaderDiv);

    currentChatMessagesDiv = document.createElement('div');
    currentChatMessagesDiv.className = 'chat-messages';
    chatDisplay.appendChild(currentChatMessagesDiv);

    const inputArea = document.createElement('footer');
    inputArea.className = 'chat-input-area';
    currentMessageInput = document.createElement('input');
    currentMessageInput.type = 'text';
    currentMessageInput.placeholder = 'Reply to user...';
    currentMessageInput.id = `input_${chatId}`; 
    currentSendButton = document.createElement('button');
    currentSendButton.className = 'send-button';
    currentSendButton.innerHTML = '➤'; 

    inputArea.appendChild(currentMessageInput);
    inputArea.appendChild(currentSendButton);
    chatDisplay.appendChild(inputArea);

    const canInteract = (chatStatus === 'active' || chatStatus === 'pending');
    currentMessageInput.disabled = !canInteract;
    currentSendButton.disabled = !canInteract;
    if (!canInteract) {
        currentMessageInput.placeholder = "Chat is closed.";
    }

    currentSendButton.addEventListener('click', sendMentorMessage);
    currentMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
             e.preventDefault();
             sendMentorMessage();
        }
    });

    const selectedMessagesRef = db.ref('chats/' + chatId + '/messages').orderByChild('timestamp');

    currentMessagesListenerRef = selectedMessagesRef;

    currentChatMessagesDiv.innerHTML = '';

    selectedMessagesRef.on('child_added', (snapshot) => {
        const msg = snapshot.val();
        if (msg) {
            displayMessageInMentorView(msg.text, msg.sender, chatId); 
        }
    }, (error) => {
        console.error(`Error listening to messages for ${chatId}:`, error);
        displayMessageInMentorView(`Error loading messages: ${error.message}`, 'system', chatId);
    });

     console.log(`Attached message listener for ${selectedChatId}`);

    if (!currentMessageInput.disabled) {
        currentMessageInput.focus();
    }
}

function showNoChatSelected() {

     if (currentMessagesListenerRef) {
         currentMessagesListenerRef.off();
         currentMessagesListenerRef = null;
         console.log(`Detached message listener while showing no chat.`);
     }

     chatDisplay.innerHTML = ''; 

     const placeholder = document.getElementById('noChatSelected') || document.createElement('div');
     placeholder.id = 'noChatSelected'; 
     placeholder.innerHTML = '← Select a chat from the left panel.'; 

     placeholder.style.display = 'flex';
     placeholder.style.flexDirection = 'column';
     placeholder.style.justifyContent = 'center';
     placeholder.style.alignItems = 'center';
     placeholder.style.height = '100%';
     placeholder.style.color = 'rgba(255, 255, 255, 0.6)';
     placeholder.style.fontStyle = 'italic';
     placeholder.style.fontSize = '1.1em';
     placeholder.style.flexGrow = '1';
     placeholder.style.textAlign = 'center';
     placeholder.style.padding = 'var(--spacing-xl)';

     chatDisplay.appendChild(placeholder);

     selectedChatId = null; 

     currentChatMessagesDiv = null;
     currentMessageInput = null;
     currentSendButton = null;
     currentChatHeaderDiv = null;
     currentCloseChatButton = null; 
}

function updateChatInList(chatId, metadata) {
    let listItem = activeChats[chatId]?.element;
    const chatStatus = metadata.status || 'unknown';
    const isClosed = chatStatus === 'closed'; 

    let statusText = '';
    let statusClass = `status-${chatStatus}`; 

    switch (chatStatus) {
        case 'pending': statusText = ' (Pending)'; break;
        case 'active': statusText = ' (Active)'; break;
        case 'closed': statusText = ' (Closed)'; break;
        default: statusText = ' (Unknown)';
    }

    const isNew = !listItem;
    if (isNew) {
        listItem = document.createElement('li');
        listItem.classList.add('chat-list-item');
        listItem.dataset.chatId = chatId; 
        listItem.addEventListener('click', () => selectChat(chatId));

        activeChats[chatId] = { element: listItem, metadata: metadata }; 
    } else {

         activeChats[chatId].metadata = metadata;
    }

    listItem.innerHTML = `
        <span class="status-dot ${statusClass}"></span>
        <span class="list-item-text">User #${chatId.substring(5, 15)}${statusText}</span>
        <span class="unread-indicator" style="display: none;"></span>
    `;

     if(selectedChatId === chatId && currentChatHeaderDiv) {
         listItem.classList.add('active'); 
         const headerChatWith = currentChatHeaderDiv.querySelector('.chat-with');
         if (headerChatWith) headerChatWith.textContent = `User #${chatId.substring(5, 15)}${statusText}`;

         const canInteract = (chatStatus === 'active' || chatStatus === 'pending');
         if (currentMessageInput) {
              currentMessageInput.disabled = !canInteract;
              currentMessageInput.placeholder = !canInteract ? "Chat is closed." : "Reply to user...";
         }
         if (currentSendButton) currentSendButton.disabled = !canInteract;

         if (currentCloseChatButton) {
             currentCloseChatButton.disabled = isClosed;
             currentCloseChatButton.style.display = isClosed ? 'none' : 'flex'; 
             currentCloseChatButton.title = isClosed ? "" : "Close Chat";
         }

     } else if (selectedChatId !== chatId) {
          listItem.classList.remove('active'); 
     }

     listItem.classList.toggle('closed-chat', isClosed);

     return listItem; 
}

function removeChatFromList(chatId) {
    const chatInfo = activeChats[chatId];
    if (chatInfo) {

        if (selectedChatId === chatId && currentMessagesListenerRef) {
             currentMessagesListenerRef.off();
             currentMessagesListenerRef = null;
             console.log(`Detached message listener for removed chat ${chatId}`);
        }
        chatInfo.element.remove(); 
        delete activeChats[chatId]; 

        if (selectedChatId === chatId) {

            showNoChatSelected();
        }
    }
}

function sortChatList(updatedItemsMap) {

    const currentListItems = Array.from(chatList.children).filter(li => updatedItemsMap.has(li.dataset.chatId));

    updatedItemsMap.forEach((item, chatId) => {
        if (!item.parentNode) { 
            currentListItems.push(item);
        }
    });

    currentListItems.sort((a, b) => {
        const metaA = activeChats[a.dataset.chatId]?.metadata;
        const metaB = activeChats[b.dataset.chatId]?.metadata;

        const statusOrder = { 'active': 1, 'pending': 2, 'closed': 3 };
        const statusA = statusOrder[metaA?.status] || 4; 
        const statusB = statusOrder[metaB?.status] || 4;

        if (statusA !== statusB) {
            return statusA - statusB; 
        }

        const timeA = metaA?.lastMessageAt || metaA?.createdAt || 0;
        const timeB = metaB?.lastMessageAt || metaB?.createdAt || 0;
        return timeB - timeA;
    });

    currentListItems.forEach(item => chatList.appendChild(item));
}

function initMentor() {
     try {

         setupPresence();

         chatsRef = db.ref('chats');

         const query = chatsRef.orderByChild('metadata/lastMessageAt');

         query.on('value', (snapshot) => {
             console.log('Received chat list update');
             const allChats = snapshot.val() || {};
             const currentRelevantChatIds = new Set(); 
             const listItemsToRender = new Map(); 

             Object.entries(allChats).forEach(([chatId, chatData]) => {
                 const metadata = chatData?.metadata;

                 if (metadata && (metadata.status === 'pending' || metadata.status === 'active' || metadata.status === 'closed')) {
                    currentRelevantChatIds.add(chatId);
                    const listItem = updateChatInList(chatId, metadata);
                    if(listItem) listItemsToRender.set(chatId, listItem);
                 } else {

                      if (activeChats[chatId]) {
                          removeChatFromList(chatId);
                      }
                 }
             });

             Object.keys(activeChats).forEach(chatId => {
                 if (!currentRelevantChatIds.has(chatId)) {
                     removeChatFromList(chatId);
                 }
             });

             sortChatList(listItemsToRender);

         }, (error) => {
              console.error("Firebase chat list listener error:", error);
              showNoChatSelected(); 
              const placeholder = document.getElementById('noChatSelected');
              if(placeholder) {
                    placeholder.textContent = "Error loading chats.";
                    placeholder.style.color = "red";
              }
         });

     } catch (error) {
         console.error("Firebase initialization error:", error);
         alert("Error connecting to Firebase. Dashboard may not work.");
         showNoChatSelected();
         const placeholder = document.getElementById('noChatSelected');
         if(placeholder) {
            placeholder.textContent = "Error connecting to chat service.";
            placeholder.style.color = "red";
         }
     }

    showNoChatSelected();

     window.addEventListener('beforeunload', () => {

         removePresence();

         if (chatsRef && typeof chatsRef.off === 'function') { 
             chatsRef.off();
         }

         if (currentMessagesListenerRef && typeof currentMessagesListenerRef.off === 'function') {
             currentMessagesListenerRef.off();
         }
         console.log("Detached Firebase listeners on mentor unload.");
     });
}

window.addEventListener('load', initMentor);