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

- [ ] Click the toolbar button. The side panel opens with **Find text that gets cut off**, then **Check page**, **Try your own text** and **Text length** (Normal, Longer, Much longer, Custom). Every word in the panel is plain English.
- [ ] Click **Open the demo page**, then **Check page**. "5 problems" appears, with the most serious first.
- [ ] Hover a problem: it's outlined on the page. Click it: the page scrolls to it and its details open, with **All problems** at the top to go back.
- [ ] In the details of "Waterproof hiking jacket...", **How to fix it** says **Fixes it. The box gets ... taller.**
  - [ ] **Preview on page** applies it to the page.
  - [ ] **Stop preview** puts it back.
- [ ] **Copy report**, then paste it into a GitHub issue (**Preview** tab) and into a Jira ticket. The heading, lists and code show correctly.
- [ ] **Copy screenshot**, then paste it. It's the element with some room around it, outlined. **Download screenshot** saves the same image as a file.
- [ ] Under **Try your own text** in the same details, type something short (it fits) and click **Much longer** (it's cut off, by how much). **All problems** puts the page's own text back.
- [ ] **Ignore on this site**, then **All problems**: the problem is gone and **Show 1 ignored** appears. Settings lists it under **Ignored problems**. Remove it there.
- [ ] **Copy report** above the list, then paste it: every problem, in plain text.
- [ ] <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> → **Save problems as JSON**: a file downloads.
- [ ] From any view one step in (a problem, your own text, Settings), **Back** and <kbd>Esc</kbd> both return to the main screen, and so does the name at the top.

### Longer text

- [ ] **Text length → Longer** runs straight away. Each text on the page repeats some of its own words (readable English, nothing else added), the hint under the control says so, and the list marks the problems that are **New** with longer text, first.
- [ ] **Much longer** does the same, longer.
- [ ] **Custom** makes every text twice as long. Change the number to 4 and press Enter (or **Apply**): every text gets about 4 times as long. A number above 10 says which numbers work. Back on **Normal** and then **Custom** again, it remembers 4.
- [ ] **Normal** puts every text back exactly, and the list is checked again; a reload shows nothing changed.
- [ ] Choose **Longer** again and use **Back to normal** on the page instead. Same result, and the control shows **Normal**.
- [ ] Run it again and close the side panel. The page goes back to normal by itself.
- [ ] Check a page, choose **Longer**, and open a problem. Switch to another tab and back: the problem is still open, the page still has the longer text, and **Text length** still says **Longer**. Close the panel: every page you left with longer text goes back to normal.

### Try your own text

- [ ] **Try your own text** → the panel says to click any text on the page, with **Cancel**. Click a button on the page. It shows how many characters fit and whether a translation fits.
- [ ] Do the same on a number, such as a price or a like count next to an icon. It works too, and says numbers stay the same in a translation.
- [ ] Type your own text: the button's text changes as you type, and the panel says whether it fits or what breaks.
- [ ] Try **Longer**, **Much longer**, **Long name**, **Long link** and **Paragraph**. Pressing one again shows another example.
- [ ] **Back** puts the button's text back. **Pick other text** picks another element.
- [ ] Right-click any page → **Try your own text here with Overflow Scout** opens the panel ready to pick.

### Real sites

- [ ] Open a site you work on, or a large one such as a news site. Click the toolbar button, then **Check page**. The problems are plausible: nothing that is visibly fine. With more than 12, a search field appears.
- [ ] Choose **Always allow on this site** (at the bottom), reload, and check again without clicking the toolbar button first. Settings → **Site access** lists the site; remove it.
- [ ] In a single-page app (for example GitHub), check, then follow a link inside the app. The panel says **These results are from the previous page.**
- [ ] Open `chrome://extensions` or the Chrome Web Store and open the panel. It says Chrome doesn't allow extensions there.
- [ ] **Copy screenshot** on a real site right after clicking the toolbar button works. Reload the page without clicking the button again, and Copy screenshot explains that it needs the click.

### Everything else

- [ ] <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> opens the panel.
- [ ] In the panel, <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> opens the commands, and <kbd>?</kbd> opens the shortcuts (also in Settings).
- [ ] The list works by keyboard: <kbd>j</kbd>/<kbd>k</kbd>, <kbd>Enter</kbd>, <kbd>Esc</kbd>.
- [ ] Settings → Theme → Dark, then Light, then System.
- [ ] Make the panel as narrow as Chrome allows. Nothing overlaps or is cut off.
- [ ] Remove the extension. Reopen a page you checked: nothing is left on it.

### The store update (after publishing)

- [ ] In a profile with 0.1.0 from the store, open `chrome://extensions` → **Update**. It shows 1.0.0, with no permission prompt.

## Automated checks

```sh
pnpm check                              # types, lint, formatting, unit and engine tests
pnpm build && pnpm build:e2e && pnpm test:e2e   # end-to-end, with the built extension
pnpm size                               # bundle budgets
pnpm dogfood                            # optional: 23 real sites, contact sheets in .dogfood/
```
