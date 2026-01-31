FocusMode Plus

A minimalist, high-discipline Chrome extension built to help you stay focused by blocking distracting websites and keywords.

Features

Dashboard UI: A clean, full-screen dashboard for managing your focus sessions.

Custom Blocklist: Add specific domains (e.g., youtube.com) or general keywords (e.g., news).

Strict Focus Timer: Websites remain blocked until the countdown reaches zero.

Emergency Unlock: A text-based security feature that requires a pre-set "Unlock Phrase" to end a session early.

Anti-Cheat Redirects: Automatically detects and redirects attempts to access chrome://extensions or chrome://settings during active focus sessions.

Manifest V3: Built using the latest Chrome extension standards for better performance and privacy.

Project Structure

manifest.json: The extension manifest defining permissions and background scripts.

dashboard.html: The full-screen management interface.

dashboard.js: Handles timer logic, UI updates, and storage.

background.js: The service worker managing network blocking rules and anti-cheat redirects.

Installation

Create a dedicated folder for the project (e.g., focus-mode-plus).

Save the four project files (manifest.json, dashboard.html, dashboard.js, background.js) into that folder.

Open Google Chrome and go to chrome://extensions/.

Enable Developer mode (toggle in the top-right corner).

Click Load unpacked and select your project folder.

The extension is now installed. Pin it to your toolbar for easy access.

How to Use

Configure: Click the extension icon to open the Dashboard. Add your distracting sites and keywords.

Setup: Enter the number of minutes you wish to focus and define an Unlock Phrase.

Focus: Click "Start Focus Mode." Your sites are now blocked.

Discipline: If you try to access a blocked site or Chrome's extension settings, you will be bounced back to the Dashboard.

Unlock: To stop early, enter your Unlock Phrase in the emergency section. Otherwise, wait for the timer to expire.

Technical Details

Engine: declarativeNetRequest for high-performance blocking.

Persistence: chrome.storage.local for saving lists and session states.

Lifecycle: chrome.alarms for managing the timer background process.
