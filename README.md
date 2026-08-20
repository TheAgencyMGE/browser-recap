# Browser Recap

Browser Recap turns real Chrome activity into a visual history of your time on the web: Today, Week, Month, Year and All-Time summaries, full-screen recap stories, Day Replay, records, categories and an archive that stays on your device.

It is inspired by the same local-first, honest-data philosophy as [PC Recap](https://github.com/TheAgencyMGE/pc-recap), adapted for browser activity.

## What it does

- Tracks the domain in the active Chrome tab while Chrome is focused and the computer is active.
- Builds Today, Week, Month, Year and All-Time recaps.
- Generates colorful full-screen recap stories and downloadable recap cards.
- Shows top sites, categories, active days, longest sessions, peak hours, browsing streaks and new domains.
- Replays individual days as a chronological browsing timeline.
- Keeps page titles off by default. Full URLs are never stored in tracked sessions.
- Lets you exclude domains or pause tracking instantly.
- Optionally imports Chrome history as **visit clues only**. Imported history is never converted into fake time-spent estimates.
- Exports/imports local `.browserrecap` backups.
- Stores activity locally using IndexedDB. No account, ads, analytics, cloud sync or external AI.

Browser Recap never creates demo activity or placeholder statistics. A new archive stays empty until real activity is tracked.

## Permissions

- `tabs` — reads the active tab's URL to derive its domain, and optionally its title if the user enables title storage.
- `idle` — stops counting when the computer is idle or locked.
- `storage` — stores settings and a small crash-safe checkpoint for the currently active session.
- `alarms` — checkpoints the current session once per minute so a browser crash does not invent extra active time.
- `history` — **optional and temporary**. Requested only when the user chooses Historical Recovery, used locally to aggregate domain visit counts, then removed immediately.

No host permissions are requested.

## Install locally

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this repository folder.
6. Read the onboarding disclosure and choose whether to start tracking.

## Development

There is no build step. The extension is plain Manifest V3 HTML/CSS/JavaScript.

Run the analytics tests:

```bash
node --test tests/analytics.test.mjs
```

## Privacy

See [PRIVACY.md](PRIVACY.md). Browser Recap processes browsing activity locally and does not transmit browsing data to the developer or third parties.

## Support

Report bugs or request features through [GitHub Issues](https://github.com/TheAgencyMGE/browser-recap/issues).

## License

MIT. See [LICENSE](LICENSE).
