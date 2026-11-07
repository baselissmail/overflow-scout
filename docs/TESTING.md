# Testing a release by hand

The automated suites cover the engine, the panel and the page together (`pnpm check`, `pnpm test:e2e`). This checklist covers what they can't: a real toolbar click, real sites, the store package, and how it feels. It takes about 15 minutes.

## Set up

1. Get the build:
   - **Release:** download the zip from the GitHub release and unzip it.
   - **Your machine:** run `pnpm install && pnpm build`. The build is in `.output/chrome-mv3`.
2. Use a **fresh Chrome profile** (profile menu → **Add**), so nothing from before interferes.
3. Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select the folder.
4. Pin the extension (puzzle icon → pin). You should see the new icon: crop marks around a line, with a red tip.

For day-to-day work, `pnpm dev` opens Chrome with the extension loaded and reloads it as you edit.

## Checklist

### First run and the demo

- [ ] Click the toolbar button. The side panel opens on Home: "Save changes" turns into the German "Änderungen speichern" and runs past its button, then **Scan page**, **Test with longer text** and **Measure an element**.
- [ ] Click **Try the demo page**, then **Scan page**. Five results appear, with critical ones first.
- [ ] Hover a result: it's outlined on the page. Click it: the page scrolls to it and the details open.
- [ ] In the details of "Waterproof hiking jacket…", the height fix says **Fixes it. The box gets … taller.**
  - [ ] **Preview on page** applies it to the page.
  - [ ] **Stop preview** puts it back.
- [ ] **Copy report**, then paste it into a GitHub issue (**Preview** tab) and into a Jira ticket. The heading, lists and code show correctly.
- [ ] **Copy screenshot**, then paste it. It's the element with some room around it, outlined.
- [ ] **Ignore on this site**: the result disappears and **Show 1 ignored** appears. Settings lists it under **Ignored results**. Remove it there.
- [ ] **Export results** (footer) → **Save as JSON**: a file downloads.
- [ ] Click **Home** (the house at the top, or the name). Home shows **Back to results** with the number of issues; it brings the list back.

### Longer text

- [ ] **Longer text** runs straight away. Each text on the page repeats some of its own words (readable, no accents), and the panel lists **New with longer text** and **Already broken**.
- [ ] The bar above explains the added text and names the options used. **Change** opens the options; pick **Language samples** → German and **Apply and scan**: the page shows real German.
- [ ] **Revert** puts every text back exactly; a reload shows nothing changed. **Longer text** again, then click it once more: it reverts too.
- [ ] Run it again and use the **Revert** pill on the page instead. Same result.
- [ ] Run it again and close the side panel. The page goes back to normal by itself.

### Measure

- [ ] **Measure** → the panel says to click any text on the page, with **Cancel**. Click a button on the page. The card shows how many characters fit and whether a translation fits.
- [ ] Drag the **Length** slider: the button's text changes live, and the card says what breaks.
- [ ] Try **Name**, **Email** and your own text.
- [ ] **Close measurement** puts the button's text back.
- [ ] Right-click any page → **Measure this element with Overflow Scout** opens the panel ready to pick.

### Real sites

- [ ] Open a site you work on, or a large one such as a news site. Click the toolbar button, then **Scan page**. Results are plausible: nothing that is visibly fine.
- [ ] Choose **Always allow on this site**, reload, and scan again without clicking the toolbar button first. Settings → **Site access** lists the site; remove it.
- [ ] In a single-page app (for example GitHub), scan, then follow a link inside the app. The panel says **Results are from the previous page.**
- [ ] Open `chrome://extensions` or the Chrome Web Store and open the panel. It says Chrome doesn't allow extensions there.
- [ ] **Copy screenshot** on a real site right after clicking the toolbar button works. Reload the page without clicking the button again, and Copy screenshot explains that it needs the click.

### Everything else

- [ ] <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> opens the panel.
- [ ] In the panel, <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> opens the commands, and <kbd>?</kbd> opens the shortcuts.
- [ ] The results list works by keyboard: <kbd>j</kbd>/<kbd>k</kbd>, <kbd>Enter</kbd>, <kbd>Esc</kbd>, <kbd>/</kbd>.
- [ ] Settings → Theme → Dark, then Light, then System.
- [ ] Make the panel as narrow as Chrome allows. Nothing overlaps or is cut off.
- [ ] Remove the extension. Reopen a page you scanned: nothing is left on it.

### The store update (after publishing)

- [ ] In a profile with 0.1.0 from the store, open `chrome://extensions` → **Update**. It shows 1.0.0, with no permission prompt.

## Automated checks

```sh
pnpm check                              # types, lint, formatting, unit and engine tests
pnpm build && pnpm build:e2e && pnpm test:e2e   # end-to-end, with the built extension
pnpm size                               # bundle budgets
pnpm dogfood                            # optional: 23 real sites, contact sheets in .dogfood/
```
