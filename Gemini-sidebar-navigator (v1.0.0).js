// ==UserScript==
// @name         Gemini-sidebar-navigator (v1.0.0 - Stable Refactor)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  First version.
// @author       desrizons
// @match        https://gemini.google.com/app*
// @match        https://gemini.google.com/chat*
// @grant        GM_addStyle
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gemini.google.com
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration Area ---
    const CONFIG = {
        USER_PROMPT_SELECTOR: 'p.query-text-line', // Selector for the <p> tag containing the question text
        CHAT_CONTAINER_SELECTOR: '.chat-history.history-scroll-container', // Scrollable area for the entire chat history
        MESSAGE_CONTAINER_SELECTOR: 'div.query-content', // Direct outer container for a single message
        SIDEBAR_WIDTH: '280px',
        DEBOUNCE_DELAY_MS: 400, // Debounce delay for MutationObserver scan trigger
        INITIAL_SCAN_DELAY_MS: 3000, // Delay for the initial scan
        // Dark mode colors
        DARK_BACKGROUND_PRIMARY: '#202124',
        DARK_TEXT_PRIMARY: '#e8eaed',
        DARK_TEXT_SECONDARY: '#bdc1c6',
        DARK_BORDER_COLOR: 'rgba(232, 234, 237, 0.12)',
        DARK_LINK_HOVER_BG: 'rgba(232, 234, 237, 0.08)',
        DARK_HIGHLIGHT_BLUE: '#8ab4f8',
        // Log prefix
        LOG_PREFIX: '[GS v1.0.0]'
    };

    // --- Global Variables ---
    let sidebarElement;
    let questionListULElement;
    let domInteractionCounter = 0; // Used to generate unique DOM IDs
    let rescanTimeoutId = null;

    // --- Logging Functions ---
    function log(message, ...args) { console.log(`${CONFIG.LOG_PREFIX} ${message}`, ...args); }
    function warn(message, ...args) { console.warn(`${CONFIG.LOG_PREFIX} ${message}`, ...args); }
    function error(message, ...args) { console.error(`${CONFIG.LOG_PREFIX} ${message}`, ...args); }

    // --- Core Functionality ---

    /**
     * Creates and displays the UI framework for the sidebar (HTML structure and basic styles).
     * @returns {boolean} True if UI creation was successful or if it already exists, false otherwise.
     */
    function createSidebarUI() {
        log("createSidebarUI: Attempting to create or ensure UI exists...");
        if (document.getElementById('gemini-questions-nav-sidebar')) {
            sidebarElement = document.getElementById('gemini-questions-nav-sidebar');
            questionListULElement = sidebarElement.querySelector('#gemini-questions-nav-list');
            if (!questionListULElement) { // Should not happen if sidebar exists and is ours
                error("createSidebarUI: Sidebar div exists but UL is missing! Recreating UL.");
                questionListULElement = document.createElement('ul');
                questionListULElement.id = 'gemini-questions-nav-list';
                sidebarElement.appendChild(questionListULElement);
            }
            log("createSidebarUI: Sidebar UI already exists.");
            return true;
        }
        try {
            sidebarElement = document.createElement('div');
            sidebarElement.id = 'gemini-questions-nav-sidebar';

            const titleElement = document.createElement('h3');
            titleElement.id = 'gemini-questions-nav-sidebar-title';
            titleElement.textContent = 'Questions'; // Use textContent
            sidebarElement.appendChild(titleElement);

            questionListULElement = document.createElement('ul');
            questionListULElement.id = 'gemini-questions-nav-list';
            sidebarElement.appendChild(questionListULElement);

            if (!document.body) {
                error("createSidebarUI: document.body not available for appending sidebar!");
                return false;
            }
            document.body.appendChild(sidebarElement);
            log("createSidebarUI: Sidebar element appended to body.");

            const toggleButton = document.createElement('div');
            toggleButton.id = 'gemini-nav-sidebar-toggle-button';
            toggleButton.textContent = '‹'; // Use textContent
            document.body.appendChild(toggleButton);
            log("createSidebarUI: Toggle button appended to body.");

            toggleButton.addEventListener('click', () => {
                sidebarElement.classList.toggle('collapsed');
                toggleButton.classList.toggle('collapsed');
                toggleButton.textContent = sidebarElement.classList.contains('collapsed') ? '›' : '‹'; // Use textContent
            });

            log("createSidebarUI: UI skeleton created successfully.");
            return true;
        } catch (e) {
            error("createSidebarUI: CRITICAL error during UI creation:", e);
            return false;
        }
    }

    /**
     * Scans the current DOM for questions and completely rebuilds the sidebar list content.
     */
    function populateSidebar() {
        log("populateSidebar: Starting scan and full rebuild of sidebar content...");
        if (!sidebarElement || !questionListULElement || !document.body.contains(sidebarElement)) {
            warn("populateSidebar: Sidebar UI not ready or detached. Attempting to recreate UI first.");
            if (!createSidebarUI()) {
                error("populateSidebar: Failed to ensure sidebar UI. Aborting content population.");
                return;
            }
        }

        try {
            // 1. Safely clear existing list (TrustedHTML safe)
            while (questionListULElement.firstChild) {
                questionListULElement.removeChild(questionListULElement.firstChild);
            }
            log("populateSidebar: Previous sidebar items cleared safely.");

            // 2. Get all question text elements in the current DOM that match the criteria
            const questionTextElements = Array.from(document.querySelectorAll(CONFIG.USER_PROMPT_SELECTOR));
            log(`populateSidebar: Found ${questionTextElements.length} raw elements for USER_PROMPT_SELECTOR.`);

            // 3. Sort by document order (theoretically querySelectorAll already guarantees this, but explicit sorting is safer)
            questionTextElements.sort((a, b) => {
                const pos = a.compareDocumentPosition(b);
                if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
                return 0;
            });

            let itemsAddedCount = 0;
            questionTextElements.forEach((textEl) => {
                const questionText = textEl.textContent ? textEl.textContent.trim() : "";
                if (!questionText) return; // Skip empty text

                const messageContainer = textEl.closest(CONFIG.MESSAGE_CONTAINER_SELECTOR);
                if (!messageContainer || !document.body.contains(messageContainer)) {
                    // warn(`populateSidebar: No valid/attached MESSAGE_CONTAINER for text: "${questionText.substring(0, 20)}...". Skipping.`);
                    return; // Skip if no valid parent container or detached from DOM
                }

                // Assign a unique, stable ID to messageContainer for navigation
                let scrollTargetId = messageContainer.id;
                if (!scrollTargetId || !scrollTargetId.startsWith('gemini-qnav-msg-')) { // If no ID, or ID is not in our script's format
                    scrollTargetId = `gemini-qnav-msg-${domInteractionCounter++}`;
                    messageContainer.id = scrollTargetId;
                }

                // Create sidebar list item and link
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                link.href = '#'; // JavaScript controls navigation
                link.textContent = questionText.length > 60 ? questionText.substring(0, 57) + '...' : questionText; // Use textContent
                link.title = questionText;

                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetEl = document.getElementById(scrollTargetId);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        targetEl.style.transition = 'outline 0.1s ease-out';
                        targetEl.style.outline = `2px solid ${CONFIG.DARK_HIGHLIGHT_BLUE}`;
                        setTimeout(() => { if (targetEl) targetEl.style.outline = 'none'; }, 2000);
                    } else {
                        warn(`populateSidebar LinkClick: Scroll target ID "${scrollTargetId}" NOT FOUND for text "${questionText.substring(0,20)}..."`);
                    }
                });

                listItem.appendChild(link);
                questionListULElement.appendChild(listItem);
                itemsAddedCount++;
            });
            log(`populateSidebar: Finished. Added ${itemsAddedCount} items to sidebar.`);

        } catch (e) {
            error("populateSidebar: Error during content processing:", e);
        }
    }

    /**
     * Starts the MutationObserver to listen for changes in chat content.
     */
    function startObserver() {
        log("startObserver: Setting up...");
        let targetNode = document.querySelector(CONFIG.CHAT_CONTAINER_SELECTOR);
        if (!targetNode) {
            warn(`startObserver: CHAT_CONTAINER_SELECTOR ("${CONFIG.CHAT_CONTAINER_SELECTOR}") not found. Falling back to document.body.`);
            targetNode = document.body; // Fallback, less efficient
        }
        log(`startObserver: MutationObserver will start on:`, targetNode);

        try {
            const observer = new MutationObserver((mutationsList) => {
                let needsRebuild = false;
                for (const mutation of mutationsList) {
                    if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                        // Simple check, assumes sidebar might need rebuilding if nodes are added/removed
                        // Can be optimized for more precise checks, but stability is prioritized for now
                        needsRebuild = true;
                        break;
                    }
                }
                if (needsRebuild) {
                    clearTimeout(rescanTimeoutId);
                    rescanTimeoutId = setTimeout(() => {
                        log("startObserver: DOM change detected, triggering populateSidebar.");
                        populateSidebar();
                    }, CONFIG.DEBOUNCE_DELAY_MS);
                }
            });
            observer.observe(targetNode, { childList: true, subtree: true });
            log("startObserver: MutationObserver is now observing.");
        } catch (e) {
            error("startObserver: Failed to start MutationObserver:", e);
        }
    }

    /**
     * Script initialization function.
     */
    function init() {
        log("Initializing script...");
        try {
            if (document.readyState === 'loading') {
                log("init: DOM is loading. Waiting for DOMContentLoaded.");
                document.addEventListener('DOMContentLoaded', function() {
                    log("init: DOMContentLoaded event fired.");
                    if (createSidebarUI()) {
                        log("init (DOMContentLoaded): UI created. Delaying first population and observer setup by " + CONFIG.INITIAL_SCAN_DELAY_MS + "ms.");
                        setTimeout(() => {
                            log("init (DOMContentLoaded): Delay ended. Starting first sidebar population and MutationObserver.");
                            try { populateSidebar(); startObserver(); } catch(e) { error("Error in delayed calls (DOMContentLoaded)", e); }
                        }, CONFIG.INITIAL_SCAN_DELAY_MS);
                    } else {
                        error("init (DOMContentLoaded): createSidebarUI failed. Script may not function as expected.");
                    }
                });
            } else { // DOM already loaded
                log("init: DOM already loaded.");
                if (createSidebarUI()) {
                    log("init (DOM ready): UI created. Delaying first population and observer setup by " + CONFIG.INITIAL_SCAN_DELAY_MS + "ms.");
                    setTimeout(() => {
                        log("init (DOM ready): Delay ended. Starting first sidebar population and MutationObserver.");
                        try { populateSidebar(); startObserver(); } catch(e) { error("Error in delayed calls (DOM ready)", e); }
                    }, CONFIG.INITIAL_SCAN_DELAY_MS);
                } else {
                    error("init (DOM ready): createSidebarUI failed. Script may not function as expected.");
                }
            }
        } catch (e) {
            error("init: CRITICAL ERROR during initialization phase:", e);
            alert(`${CONFIG.LOG_PREFIX} A critical error occurred during script initialization. Please check the browser console. The sidebar may not work.`);
        }
    }

    // --- Inject Styles ---
    GM_addStyle(`
        #gemini-questions-nav-sidebar {
            position: fixed; top: 70px; right: 10px; width: ${CONFIG.SIDEBAR_WIDTH};
            height: calc(100vh - 90px); background-color: ${CONFIG.DARK_BACKGROUND_PRIMARY};
            backdrop-filter: blur(8px); border: 1px solid ${CONFIG.DARK_BORDER_COLOR};
            border-radius: 8px; padding: 15px; box-sizing: border-box;
            z-index: 10001; overflow-y: auto; font-family: 'Google Sans', Roboto, Arial, sans-serif;
            color: ${CONFIG.DARK_TEXT_PRIMARY}; transition: right 0.3s ease-in-out, opacity 0.3s ease-in-out;
            box-shadow: 0 6px 16px rgba(0,0,0,0.25); opacity: 1;
        }
        #gemini-questions-nav-sidebar.collapsed { right: -${CONFIG.SIDEBAR_WIDTH}; opacity: 0; pointer-events: none; }
        #gemini-questions-nav-sidebar-title {
            font-size: 17px; font-weight: 500; color: ${CONFIG.DARK_TEXT_PRIMARY}; margin-top: 0;
            margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid ${CONFIG.DARK_BORDER_COLOR};
            display: flex; align-items: center;
        }
        #gemini-questions-nav-sidebar-title::before { content: '👁️'; margin-right: 10px; font-size: 20px; opacity: 0.9; }
        #gemini-questions-nav-list { list-style-type: none; padding-left: 0; margin: 0; }
        #gemini-questions-nav-list li { margin-bottom: 8px; position: relative; }
        #gemini-questions-nav-list a {
            text-decoration: none; color: ${CONFIG.DARK_TEXT_SECONDARY}; display: block; padding: 8px 10px;
            border-radius: 6px; font-size: 14px; line-height: 1.4; word-break: break-word;
            transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
        }
        #gemini-questions-nav-list a:hover { background-color: ${CONFIG.DARK_LINK_HOVER_BG}; color: ${CONFIG.DARK_HIGHLIGHT_BLUE}; }
        #gemini-nav-sidebar-toggle-button {
            position: fixed; top: 75px; right: calc(${CONFIG.SIDEBAR_WIDTH} + 10px); width: 28px; height: 42px;
            background-color: ${CONFIG.DARK_BACKGROUND_PRIMARY}; backdrop-filter: blur(8px);
            color: ${CONFIG.DARK_TEXT_PRIMARY}; border: 1px solid ${CONFIG.DARK_BORDER_COLOR}; border-right: none;
            border-top-left-radius: 6px; border-bottom-left-radius: 6px; cursor: pointer;
            display: flex; align-items: center; justify-content: center; z-index: 10002;
            font-size: 18px; transition: right 0.3s ease-in-out, opacity 0.3s ease-in-out;
            box-shadow: -2px 2px 8px rgba(0,0,0,0.2); opacity: 1;
        }
        #gemini-nav-sidebar-toggle-button.collapsed { right: 10px; }
    `);

    // --- Start Script ---
    init();

})();