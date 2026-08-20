# Privacy Policy — Browser Recap

**Effective date:** August 19, 2026  
**Developer:** Ryan Panda  
**Contact:** ryanpanda78@gmail.com

Browser Recap is a local-first Chrome extension that records active browsing activity on the user's device in order to create daily, weekly, monthly, yearly and all-time browsing recaps.

## Information Browser Recap handles

When tracking is enabled, Browser Recap temporarily reads the URL of the active Chrome tab so it can identify the website domain and attribute active browsing time to that domain. It also uses Chrome's idle state to stop counting time while the computer is idle or locked.

By default, Browser Recap stores only the website domain, category, session start/end time and session duration. It does **not** store the full page URL.

Page-title storage is disabled by default. If the user explicitly enables it in Settings, Browser Recap also stores the active tab's page title locally for richer Day Replay context.

## Local storage

Tracked sessions are stored locally in the extension's IndexedDB database. Extension settings and a small crash-recovery checkpoint are stored using Chrome extension storage.

Browser Recap does not send tracked browsing activity, domains, page titles, recap statistics or settings to Ryan Panda or to any third party.

## Optional Chrome history import

Browser Recap includes an optional Historical Recovery feature. It is off by default.

If the user explicitly chooses **Import Chrome history clues**, Browser Recap asks Chrome for the optional `history` permission. It reads recent browser-history entries locally, aggregates them into domain-level visit counts, stores those aggregate clues locally, and then removes the `history` permission immediately after the import completes.

Imported browser history is never converted into estimated browsing duration or mixed with tracked active-time statistics.

## Information Browser Recap does not collect or transmit

Browser Recap does not collect or transmit:

- names, email addresses or other personally identifiable information
- passwords or authentication credentials
- page contents or form entries
- personal communications
- financial or health information
- advertising identifiers
- analytics or usage telemetry
- browsing activity to a backend server

The extension has no account system, advertising, cloud database, remote code or external AI service.

## Data controls

Users can:

- pause tracking at any time
- exclude individual domains from tracking
- keep page-title storage disabled
- export a local backup
- erase all Browser Recap data from Settings

## Data sharing and sale

Browser Recap does not sell, rent, share or transfer user browsing data to third parties.

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Changes

If Browser Recap's data practices change in a future version, this policy will be updated before those changes are published.

## Contact

Questions about this privacy policy can be sent to **ryanpanda78@gmail.com**.
