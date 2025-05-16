# Gemini Sidebar Navigator (v1.0.0)
![image](https://github.com/user-attachments/assets/83729625-643b-411b-aebd-e56b019edcac)

## Overview

 **Gemini Sidebar Navigator** is a UserScript designed to enhance the user experience on Google's Gemini web interface (`gemini.google.com`). It adds a convenient, collapsible sidebar that lists all the user's prompts (questions) from the current chat session. Clicking on a prompt in the sidebar will smoothly scroll the main chat window to that specific prompt, highlighting it briefly for easy identification.

This script is particularly useful for long conversations, allowing users to quickly revisit previous questions without manually scrolling through the entire chat history.

## Features

* **Automatic Prompt Extraction**: Scans the Gemini chat interface to find all user-submitted prompts.
* **Navigable Sidebar**: Displays the extracted prompts as a clickable list in a dedicated sidebar.
* **Smooth Scrolling**: Clicking a prompt in the sidebar smoothly scrolls the chat view to the corresponding message.
* **Prompt Highlighting**: Briefly highlights the selected prompt in the chat for better visibility.
* **Collapsible UI**: The sidebar can be easily shown or hidden using a toggle button.
* **Dynamic Updates**: Uses a `MutationObserver` to detect new prompts added to the chat and automatically updates the sidebar.
* **Configurable**: Key parameters like CSS selectors and debounce delays are grouped in a `CONFIG` object for easier modification.
* **Dark Mode Styling**: The sidebar is styled to match a dark theme, consistent with modern web UIs.

## Installation

To use this script, you need a userscript manager browser extension. Popular choices include:

* [Tampermonkey](https://www.tampermonkey.net/) (for Chrome, Firefox, Edge, Safari, Opera, etc.)
* Greasemonkey (for Firefox)
* Violentmonkey (for Chrome, Firefox, Edge, Opera)

Once you have a userscript manager installed:

1.  Click on the "Install" button for this script (e.g., on Greasy Fork or if you have the `.user.js` file locally).
2.  Your userscript manager will open a new tab or window showing the script's source code and an "Install" button.
3.  Click the "Install" button in your userscript manager.
4.  The script will now be active when you visit `https://gemini.google.com/app*` or `https://gemini.google.com/chat*`.

## How It Works

The script operates through several key components:

1.  **Metadata Block (`// ==UserScript== ... // ==/UserScript==`)**:
    * Defines essential information for the userscript manager, such as the script's name, version, author, the websites it should run on (`@match`), and special permissions it requires (`@grant GM_addStyle` for injecting custom CSS).

2.  **Configuration (`CONFIG` object)**:
    * Stores constants like CSS selectors for identifying user prompts, chat containers, and message elements.
    * Defines UI parameters like sidebar width, debounce delays for performance optimization, and color schemes for dark mode.

3.  **UI Creation (`createSidebarUI` function)**:
    * Dynamically generates the HTML elements for the sidebar (a `div` container, a title `h3`, and an unordered list `ul` for prompts) and a toggle button.
    * Appends these elements to the `document.body`.
    * Adds an event listener to the toggle button to expand or collapse the sidebar.

4.  **Sidebar Population (`populateSidebar` function)**:
    * Clears any existing items from the sidebar's prompt list.
    * Queries the DOM using `CONFIG.USER_PROMPT_SELECTOR` to find all HTML elements containing user prompt text.
    * For each prompt found:
        * Extracts the text.
        * Finds the parent message container and assigns it a unique ID if it doesn't have one (this ID is used for scrolling).
        * Creates a list item (`<li>`) and an anchor tag (`<a>`) for the sidebar.
        * Sets the anchor text to the (potentially truncated) prompt text and its `title` attribute to the full prompt.
        * Adds a click event listener to the anchor tag. When clicked:
            * It prevents the default link behavior.
            * Scrolls the corresponding message container into view smoothly.
            * Temporarily highlights the message container with an outline.
        * Appends the new list item to the sidebar's list.

5.  **Dynamic Updates (`startObserver` function)**:
    * Initializes a `MutationObserver` to watch for changes within the chat container (`CONFIG.CHAT_CONTAINER_SELECTOR`).
    * When child nodes are added or removed (e.g., a new prompt is submitted or a response is generated), the observer triggers.
    * To avoid excessive updates during rapid DOM changes (like a streaming response), a debounce mechanism is used: `populateSidebar` is called only after a short delay (`CONFIG.DEBOUNCE_DELAY_MS`) where no further changes are detected.

6.  **Initialization (`init` function)**:
    * This is the entry point of the script.
    * It waits for the DOM to be fully loaded (`DOMContentLoaded`).
    * Calls `createSidebarUI` to set up the sidebar.
    * After a brief initial delay (`CONFIG.INITIAL_SCAN_DELAY_MS`) to allow the page to fully render, it calls `populateSidebar` for the first time and then `startObserver` to begin monitoring for chat updates.

7.  **Styling (`GM_addStyle` call)**:
    * Injects a block of CSS into the page to style the sidebar, its title, the list of prompts, individual prompt links, and the toggle button. This ensures the sidebar has a consistent and visually appealing look that integrates well with the Gemini interface, particularly in a dark theme.

## Code Structure

The script is wrapped in an Immediately Invoked Function Expression (IIFE) `(function() { ... })();` to create a private scope, preventing conflicts with the page's own JavaScript or other userscripts. It uses `'use strict';` for stricter JavaScript parsing and error handling.

Key functions include:

* `log`, `warn`, `error`: Helper functions for console logging with a script-specific prefix.
* `createSidebarUI()`: Builds the sidebar's HTML structure.
* `populateSidebar()`: Finds questions and fills the sidebar.
* `startObserver()`: Sets up the `MutationObserver` to watch for chat changes.
* `init()`: Orchestrates the script's startup sequence.

## Configuration Details

The `CONFIG` object at the top of the script allows for some customization:

* `USER_PROMPT_SELECTOR`: CSS selector to identify the `<p>` elements containing user questions.
* `CHAT_CONTAINER_SELECTOR`: CSS selector for the main scrollable chat history area.
* `MESSAGE_CONTAINER_SELECTOR`: CSS selector for the direct parent `div` of a user's query.
* `SIDEBAR_WIDTH`: The width of the sidebar (e.g., `'280px'`).
* `DEBOUNCE_DELAY_MS`: Delay in milliseconds for debouncing DOM mutation events (default: `400`).
* `INITIAL_SCAN_DELAY_MS`: Delay in milliseconds before the first scan of questions (default: `3000`).
* Dark mode color variables (e.g., `DARK_BACKGROUND_PRIMARY`, `DARK_TEXT_PRIMARY`).

If Gemini's HTML structure changes in the future, these selectors might need to be updated for the script to continue working correctly.

## License

This userscript is released under the MIT License.
