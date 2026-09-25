# ◈ Tidymark

**A local-first Chrome extension that suggests folders for your bookmarks and moves them only after you approve.**

No servers, no API keys, no analytics. Tidymark only asks for the `bookmarks` and `storage` permissions, and your data never leaves your browser.

## Features

- **Scan & suggest:** simple local rules suggest a category for each bookmark, based on its title, domain and current folder. Page contents are never read.
- **You stay in control:** nothing is selected by default. You can edit any suggestion, filter with search and choose a destination folder.
- **Safe moves:** a full backup of the bookmark tree and an undo journal are saved before anything moves.
- **One-click undo:** puts moved bookmarks back in their original folder and position, and reports any conflicts.
- **Import a plan:** load a hand-reviewed (or AI-generated) JSON plan that maps bookmarks to categories.
- **Nothing is deleted:** Tidymark never deletes or merges bookmarks. Bookmarks managed by your organization are skipped.
- **Zero dependencies:** plain HTML, CSS and ES modules, with no build step.

## Install (developer mode)

1. Clone or download this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension/` folder.
4. Click the Tidymark icon in the toolbar. It opens in a new tab.

## Usage

**Scan** → select bookmarks → adjust suggestions → pick a destination folder → **Review and confirm move**.

Moved bookmarks go into `Tidymark / <Category> / <Subcategory>` under the folder you pick. If a folder with the same name already exists, Tidymark reuses it.

Search only filters what you see. Selected items that are hidden by the search are still counted and moved.

### Importing a plan

Click **Import plan (JSON)…** and choose a file like [`examples/plan.example.json`](examples/plan.example.json):

```json
{
  "format": "Tidymark plan v1",
  "bookmarks": [
    { "id": "123", "title": "…", "url": "https://…", "category": "Work / Research", "reason": "optional", "reviewRequired": false }
  ]
}
```

An entry is used only if its `id`, `title` and `url` still match the live bookmark. Entries with `reviewRequired: true` are loaded but left unselected. You can get bookmark IDs from the JSON backup.

## Backup & undo

- **Download JSON backup** exports the tree as it was before the last operation, or the current tree if nothing has moved yet. Chrome's Bookmark Manager can't import this file directly. For an HTML backup, use Chrome's own *Export bookmarks*.
- **Undo** moves bookmarks back in reverse order. Folders it created and left empty are kept. If a bookmark was changed or deleted in the meantime, Tidymark reports a conflict and keeps its entry so you can try again.
- You have to undo the previous operation before starting a new one.
- Keep the tab open while a move is running. If the tab closes partway through, reopen Tidymark and click **Undo**.
- Web Locks stop two Tidymark tabs from writing at the same time. Tidymark can't lock out changes made by Chrome Sync or other extensions, so it checks each bookmark again right before moving it.
- Uninstalling the extension deletes its local backup.

## Development

```
extension/
  manifest.json    MV3 manifest
  background.js    opens the UI tab
  classifier.mjs   categorization rules + tree flattening
  engine.mjs       move / undo with a persistent journal
  app.mjs          UI
tests/test.mjs     Node tests using a mocked chrome.bookmarks API
```

Run the tests (Node 18+):

```
npm test
```

To add or change categories, edit the `rules` in `extension/classifier.mjs`. The first matching rule wins.

API reference: https://developer.chrome.com/docs/extensions/reference/api/bookmarks

## Contributing

Issues and pull requests are welcome. Please keep the extension dependency-free, and run `npm test` before you submit.

## License

[MIT](LICENSE)
