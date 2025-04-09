// mentor.js

const chatList = document.getElementById('chatList');
const chatDisplay = document.getElementById('chatDisplay');
const noChatSelectedDiv = document.getElementById('noChatSelected');

let chatsRef = null;
let activeChats = {}; // Store chat info: { chatId: { element: liElement, metadata: {}, listener: listenerRef } }
let selectedChatId = null;

// Elements for the currently displayed chat (will be managed by selectChat)
let currentChatMessagesDiv = null;
let currentMessageInput = null;
let currentSendButton = null;
let currentChatHeaderDiv = null;
let currentCloseChatButton = null; // <-- Add variable for the close button
let currentMessagesListenerRef = null; // Ref to detach listener on chat switch

// --- Presence Variables ---
let mentorPresenceId = null;
let mentorPresenceRef = null;
let connectedRef = null;
// --- End Presence Variables ---

// Function to generate a unique ID for this mentor session
function generateMentorId() {
    return `mentor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// --- Presence Management Functions ---
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
// --- End Presence Management Functions ---


function displayMessageInMentorView(text, sender, chatIdToDisplay) {
    // Only display if the message belongs to the currently selected chat
    if (!currentChatMessagesDiv || selectedChatId !== chatIdToDisplay) {
         console.log(`Message for ${chatIdToDisplay}, but ${selectedChatId} is selected.`);
         // Add a visual cue to the chat list item for unread messages
         const listItem = activeChats[chatIdToDisplay]?.element;
         if (listItem && !listItem.classList.contains('active')) {
             const indicator = listItem.querySelector('.unread-indicator');
             if(indicator) indicator.style.display = 'inline-block'; // Show indicator
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
        // User messages appear on the RIGHT for the mentor
        messageContainer.classList.add('user-message');
        avatar.classList.add('user-avatar');
        avatar.textContent = 'U';
        messageContainer.appendChild(messageBubble); // Bubble first for right align
        messageContainer.appendChild(avatar);
    } else { // mentor or system
        messageContainer.classList.add('mentor-message'); // Style left
        if (sender === 'mentor') {
             avatar.classList.add('mentor-avatar');
             avatar.textContent = 'A';
        } else { // System message
             avatar.classList.add('system-avatar'); // Add style if needed
             avatar.textContent = 'S';
              messageBubble.style.backgroundColor = '#e0e0e0'; // Grey for system messages maybe?
              messageBubble.style.color = '#333';
        }
        messageContainer.appendChild(avatar); // Avatar first for left align
        messageContainer.appendChild(messageBubble);
    }

    currentChatMessagesDiv.appendChild(messageContainer);
    // Scroll to bottom smoothly
    currentChatMessagesDiv.scrollTo({ top: currentChatMessagesDiv.scrollHeight, behavior: 'smooth' });
}


function sendMentorMessage() {
    if (!selectedChatId || !currentMessageInput || !db || currentMessageInput.disabled) return; // Added disabled check

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
            // Check if status is 'pending' and update to 'active' if this is the first mentor message
            currentMetadataRef.child('status').get().then(snapshot => {
                 const updates = { lastMessageAt: serverTimestamp };
                 if (snapshot.val() === 'pending') {
                     updates.status = 'active';
                 }
                 currentMetadataRef.update(updates);
            });

            currentMessageInput.value = ''; // Clear input
            // Message displayed via listener
        })
        .catch(error => {
            console.error("Error sending mentor message:", error);
            // Optionally show an error in the chat window
            displayMessageInMentorView(`Error: ${error.message}`, 'system', selectedChatId);
        });
}


// --- NEW FUNCTION: Close Chat by Mentor ---
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

    // Disable button immediately for feedback
    if (currentCloseChatButton) {
        currentCloseChatButton.disabled = true;
        currentCloseChatButton.title = "Closing...";
    }
    // Disable input/send too
    if (currentMessageInput) currentMessageInput.disabled = true;
    if (currentSendButton) currentSendButton.disabled = true;


    chatMetadataRef.update({
        status: 'closed',
        closedReason: 'closedByMentor' // Record reason
    })
    .then(() => {
        console.log("Chat status updated to closed by mentor:", chatId);
        // UI update (like disabling input, updating header text, hiding close button)
        // will be handled by the main 'value' listener detecting the status change
        // via updateChatInList.
        // Optionally, display a system message in the chat view
        displayMessageInMentorView("Chat closed by mentor.", "system", chatId);
    })
    .catch(error => {
        console.error("Error closing chat:", error);
        // Re-enable button if closing failed? Or show error message.
        if (currentCloseChatButton) {
             currentCloseChatButton.disabled = false; // Re-enable if update failed
             currentCloseChatButton.title = "Close Chat";
        }
         if (currentMessageInput) currentMessageInput.disabled = false; // Re-enable if active before
         if (currentSendButton) currentSendButton.disabled = false;
        // Maybe display an error message in the chat window
        displayMessageInMentorView(`Error closing chat: ${error.message}`, 'system', chatId);
    });
}
// --- END NEW FUNCTION ---

function selectChat(chatId) {
    if (selectedChatId === chatId) return; // Already selected

    // 1. Deselect previous chat (UI and listener)
    if (selectedChatId && activeChats[selectedChatId]) {
        activeChats[selectedChatId].element.classList.remove('active');
        // Detach the listener for the PREVIOUS chat's messages
        if (currentMessagesListenerRef) {
            currentMessagesListenerRef.off(); // Use the stored ref
             console.log(`Detached message listener for ${selectedChatId}`);
        }
        currentMessagesListenerRef = null; // Clear the stored ref
    }

    // 2. Select the new chat
    selectedChatId = chatId;
    const chatInfo = activeChats[chatId];

    // Clear previous chat display content
    chatDisplay.innerHTML = '';
    const noChatDiv = document.getElementById('noChatSelected');
    if (noChatDiv) noChatDiv.style.display = 'none';

    if (!chatInfo || !chatInfo.metadata) { // Check metadata exists
        console.error("Selected chat info or metadata not found:", chatId);
        showNoChatSelected(); // Show placeholder if chat data is missing
        return;
    }

    // 3. Update UI for the selected chat
    chatInfo.element.classList.add('active');
    const indicator = chatInfo.element.querySelector('.unread-indicator');
    if(indicator) indicator.style.display = 'none'; // Hide indicator on select


    // 4. Create the chat interface elements dynamically
    // Header
    currentChatHeaderDiv = document.createElement('header');
    currentChatHeaderDiv.className = 'chat-header';
    const chatStatus = chatInfo.metadata.status || 'unknown'; // Get status
    const statusText = ` (${chatStatus})`;

    // --- Create Close Button ---
    currentCloseChatButton = document.createElement('button');
    currentCloseChatButton.innerHTML = '×'; // 'X' symbol
    currentCloseChatButton.className = 'close-chat-button';
    currentCloseChatButton.title = 'Close Chat';
    // Add listener - important to use the correct chatId here
    currentCloseChatButton.addEventListener('click', () => closeChatByMentor(chatId));
    // Hide or disable if chat is already closed
    const isClosed = (chatStatus === 'closed');
    if (isClosed) {
        currentCloseChatButton.disabled = true;
        currentCloseChatButton.style.display = 'none'; // Hide if closed initially
    }
    // --- End Close Button Creation ---

    currentChatHeaderDiv.innerHTML = `
        <div class="avatar user-avatar-header">U</div> <!-- User on left -->
        <div class="chat-with">User #${chatId.substring(5, 15)}${statusText}</div>
        <div class="header-icons">
             <!-- Close button will be appended here -->
             <div class="avatar mentor-avatar-header">A</div> <!-- Mentor on right -->
        </div>`;
    // Append the close button to the header icons container
    currentChatHeaderDiv.querySelector('.header-icons').prepend(currentCloseChatButton); // Prepend to put it before avatar
    chatDisplay.appendChild(currentChatHeaderDiv);

    // Messages Area
    currentChatMessagesDiv = document.createElement('div');
    currentChatMessagesDiv.className = 'chat-messages';
    chatDisplay.appendChild(currentChatMessagesDiv);

    // Input Area
    const inputArea = document.createElement('footer');
    inputArea.className = 'chat-input-area';
    currentMessageInput = document.createElement('input');
    currentMessageInput.type = 'text';
    currentMessageInput.placeholder = 'Reply to user...';
    currentMessageInput.id = `input_${chatId}`; // Unique ID if needed
    currentSendButton = document.createElement('button');
    currentSendButton.className = 'send-button';
    currentSendButton.innerHTML = '➤'; // Send icon

    inputArea.appendChild(currentMessageInput);
    inputArea.appendChild(currentSendButton);
    chatDisplay.appendChild(inputArea);

    // Disable input/send if chat is not active/pending
    const canInteract = (chatStatus === 'active' || chatStatus === 'pending');
    currentMessageInput.disabled = !canInteract;
    currentSendButton.disabled = !canInteract;
    if (!canInteract) {
        currentMessageInput.placeholder = "Chat is closed.";
    }


    // Add event listeners for the new input/button
    currentSendButton.addEventListener('click', sendMentorMessage);
    currentMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
             e.preventDefault();
             sendMentorMessage();
        }
    });

    // 5. Load and Listen for Messages for the *selected* chat
    const selectedMessagesRef = db.ref('chats/' + chatId + '/messages').orderByChild('timestamp');
    // Store the ref to detach later
    currentMessagesListenerRef = selectedMessagesRef;

    // Clear existing messages div before loading new ones
    currentChatMessagesDiv.innerHTML = '';

    selectedMessagesRef.on('child_added', (snapshot) => {
        const msg = snapshot.val();
        if (msg) {
            displayMessageInMentorView(msg.text, msg.sender, chatId); // Pass chatId for check
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
     // Detach listener if a chat was previously selected
     if (currentMessagesListenerRef) {
         currentMessagesListenerRef.off();
         currentMessagesListenerRef = null;
         console.log(`Detached message listener while showing no chat.`);
     }

     chatDisplay.innerHTML = ''; // Clear everything
     // Re-create or get the placeholder div
     const placeholder = document.getElementById('noChatSelected') || document.createElement('div');
     placeholder.id = 'noChatSelected'; // Ensure it has the ID
     placeholder.innerHTML = '← Select a chat from the left panel.'; // Reset text
      // Apply necessary styles if recreated (or ensure they are in CSS)
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

     selectedChatId = null; // Clear selection
     // Reset current element vars
     currentChatMessagesDiv = null;
     currentMessageInput = null;
     currentSendButton = null;
     currentChatHeaderDiv = null;
     currentCloseChatButton = null; // Reset close button ref
}

function updateChatInList(chatId, metadata) {
    let listItem = activeChats[chatId]?.element;
    const chatStatus = metadata.status || 'unknown';
    const isClosed = chatStatus === 'closed'; // Check if closed

    // Determine text based on status and set class for dot
    let statusText = '';
    let statusClass = `status-${chatStatus}`; // e.g., status-pending, status-active

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
        listItem.dataset.chatId = chatId; // Store full ID
        listItem.addEventListener('click', () => selectChat(chatId));
        // chatList.appendChild(listItem); // Add later after sorting potentially
        activeChats[chatId] = { element: listItem, metadata: metadata }; // Store ref
    } else {
         // Update existing metadata store
         activeChats[chatId].metadata = metadata;
    }

    // Update display text and status indicator
    // Added unread indicator element, hidden by default
    listItem.innerHTML = `
        <span class="status-dot ${statusClass}"></span>
        <span class="list-item-text">User #${chatId.substring(5, 15)}${statusText}</span>
        <span class="unread-indicator" style="display: none;"></span>
    `;

     // If this is the selected chat, update its header too
     if(selectedChatId === chatId && currentChatHeaderDiv) {
         listItem.classList.add('active'); // Ensure active class is set
         const headerChatWith = currentChatHeaderDiv.querySelector('.chat-with');
         if (headerChatWith) headerChatWith.textContent = `User #${chatId.substring(5, 15)}${statusText}`;

          // Update input/button disabled state based on new status
         const canInteract = (chatStatus === 'active' || chatStatus === 'pending');
         if (currentMessageInput) {
              currentMessageInput.disabled = !canInteract;
              currentMessageInput.placeholder = !canInteract ? "Chat is closed." : "Reply to user...";
         }
         if (currentSendButton) currentSendButton.disabled = !canInteract;

         // Update close button state
         if (currentCloseChatButton) {
             currentCloseChatButton.disabled = isClosed;
             currentCloseChatButton.style.display = isClosed ? 'none' : 'flex'; // Hide if closed
             currentCloseChatButton.title = isClosed ? "" : "Close Chat";
         }

     } else if (selectedChatId !== chatId) {
          listItem.classList.remove('active'); // Ensure not active if not selected
     }

     // Add/remove specific class for styling closed chats in list if desired
     listItem.classList.toggle('closed-chat', isClosed);


     return listItem; // Return the updated/created item for sorting
}


function removeChatFromList(chatId) {
    const chatInfo = activeChats[chatId];
    if (chatInfo) {
        // If listening to messages for this chat, detach listener
        if (selectedChatId === chatId && currentMessagesListenerRef) {
             currentMessagesListenerRef.off();
             currentMessagesListenerRef = null;
             console.log(`Detached message listener for removed chat ${chatId}`);
        }
        chatInfo.element.remove(); // Remove from UI
        delete activeChats[chatId]; // Remove from internal tracking

        if (selectedChatId === chatId) {
            // The currently viewed chat was closed/removed
            showNoChatSelected();
        }
    }
}

function sortChatList(updatedItemsMap) {
    // Get current items from the DOM that are still relevant
    const currentListItems = Array.from(chatList.children).filter(li => updatedItemsMap.has(li.dataset.chatId));

    // Add any newly created items that aren't in the DOM yet
    updatedItemsMap.forEach((item, chatId) => {
        if (!item.parentNode) { // Only add if not already in the list
            currentListItems.push(item);
        }
    });

    // Sort based on metadata (status priority, then time)
    currentListItems.sort((a, b) => {
        const metaA = activeChats[a.dataset.chatId]?.metadata;
        const metaB = activeChats[b.dataset.chatId]?.metadata;

        // Status Order: active > pending > closed > unknown/other
        const statusOrder = { 'active': 1, 'pending': 2, 'closed': 3 };
        const statusA = statusOrder[metaA?.status] || 4; // Assign lower priority to others
        const statusB = statusOrder[metaB?.status] || 4;

        if (statusA !== statusB) {
            return statusA - statusB; // Sort by status first
        }

        // If status is the same, sort by last message time (descending - newest first)
        // For closed chats, might want to sort by closed time or creation time if lastMessageAt isn't updated on close
        const timeA = metaA?.lastMessageAt || metaA?.createdAt || 0;
        const timeB = metaB?.lastMessageAt || metaB?.createdAt || 0;
        return timeB - timeA;
    });

    // Re-append sorted items to the chatList
    currentListItems.forEach(item => chatList.appendChild(item));
}


function initMentor() {
     try {
         // --- Setup Mentor Presence FIRST ---
         setupPresence();
         // ----------------------------------

         chatsRef = db.ref('chats');
         // Order first by status priority (need to handle this in sorting logic),
         // then by last message time. Firebase doesn't support multi-field complex sorting easily,
         // so we fetch ordered by time and re-sort client-side.
         const query = chatsRef.orderByChild('metadata/lastMessageAt');

         query.on('value', (snapshot) => {
             console.log('Received chat list update');
             const allChats = snapshot.val() || {};
             const currentRelevantChatIds = new Set(); // Keep track of IDs processed in this update
             const listItemsToRender = new Map(); // Map to hold updated/new list items for sorting

             // Process existing and new chats
             Object.entries(allChats).forEach(([chatId, chatData]) => {
                 const metadata = chatData?.metadata;
                 // Decide which chats to show in the list.
                 // Show active, pending, and closed chats. Filter others like 'unattended'.
                 if (metadata && (metadata.status === 'pending' || metadata.status === 'active' || metadata.status === 'closed')) {
                    currentRelevantChatIds.add(chatId);
                    const listItem = updateChatInList(chatId, metadata);
                    if(listItem) listItemsToRender.set(chatId, listItem);
                 } else {
                      // This chat is either old, has no metadata, or has a status we don't list (like 'unattended', 'userLeft', 'timeout')
                      // Ensure it's removed if it was previously in our list
                      if (activeChats[chatId]) {
                          removeChatFromList(chatId);
                      }
                 }
             });

             // Remove chats from the list that no longer exist in the filtered snapshot
             // (e.g., deleted from DB or status changed to something we filter out)
             Object.keys(activeChats).forEach(chatId => {
                 if (!currentRelevantChatIds.has(chatId)) {
                     removeChatFromList(chatId);
                 }
             });

             // Sort and render the list
             sortChatList(listItemsToRender);

         }, (error) => {
              console.error("Firebase chat list listener error:", error);
              showNoChatSelected(); // Show placeholder on error
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

    // Show the initial placeholder
    showNoChatSelected();

     window.addEventListener('beforeunload', () => {
         // --- Remove Mentor Presence ---
         removePresence();
         // ---------------------------

         // Detach the main chat list listener
         if (chatsRef && typeof chatsRef.off === 'function') { // Check if chatsRef is valid before calling off
             chatsRef.off();
         }
         // Detach listener for the currently selected chat's messages
         if (currentMessagesListenerRef && typeof currentMessagesListenerRef.off === 'function') {
             currentMessagesListenerRef.off();
         }
         console.log("Detached Firebase listeners on mentor unload.");
     });
}

window.addEventListener('load', initMentor);