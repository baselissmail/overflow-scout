# Releasing

Overflow Scout 1.0 goes out as an **update to the existing Chrome Web Store item** ([`mfinclnlokodigpdeefonldgmcdgnpim`](https://chromewebstore.google.com/detail/overflow-scout/mfinclnlokodigpdeefonldgmcdgnpim), version 0.1.0). The ID stays the same, and existing users get 1.0 automatically.

1.0 asks for fewer permissions than 0.1.0, which had access to all websites and a content script on every page. So existing users update without a new permission prompt.

## Once, before the first release

1. **Make the repository public.** This is recommended. The extension says it's open source under MIT, and three things need a public repository:
   - the privacy policy URL (GitHub Pages);
   - the support URL (GitHub Issues);
   - free branch protection.

   It's under **Settings → General → Danger zone → Change visibility**. If you keep it private, host `site/privacy.html` somewhere public instead, for example a small separate public repo with Pages.

2. **Turn on Pages.** Go to **Settings → Pages → Source: GitHub Actions**. Then run the **Site** workflow (**Actions → Site → Run workflow**) and check that https://baselissmail.github.io/overflow-scout/privacy.html loads.
3. **Let release-please open pull requests.** Go to **Settings → Actions → General → Workflow permissions** and tick **Allow GitHub Actions to create and approve pull requests**.

## Each release

1. **Merge to `main`.** The **Release** workflow keeps a pull request named `chore(main): release x.y.z` up to date, with the version bump and the changelog. The version follows the commits since the last release: `fix:` gives a patch, `feat:` a minor version.
2. **Review and merge that pull request.** The workflow then:
   - tags `vx.y.z`;
   - publishes a GitHub release with the changelog;
   - attaches `overflow-scout-x.y.z-chrome.zip`, the file you upload to the store.

   Pull requests opened by GitHub Actions don't trigger CI on their own. The release PR only changes the version and the changelog, and `main` was already green.

3. **Test the zip by hand** with [TESTING.md](TESTING.md) (about 15 minutes).
4. **Update the store item** (next section).

To build the zip locally instead, run `pnpm zip` on the release tag. The result is in `.output/`.

## Updating the store item

In the [developer dashboard](https://chrome.google.com/webstore/devconsole), open **Overflow Scout**. All the text below is in [store/listing.md](../store/listing.md), ready to paste.

1. **Package → Upload new package.** Upload the release zip. Its version must be higher than the published one.
2. **Store listing:**
   - Replace the description.
   - Upload `store/icon-128.png`.
   - Upload the five screenshots in `store/screenshots/` in their numbered order. Remove the old 0.1 ones.
   - Upload the small promo tile and the marquee.
   - Set the homepage and support URLs.
   - Keep the category (Developer Tools) and the language (English).
3. **Privacy practices:**
   - Paste the single purpose.
   - Paste the justification for each permission. `contextMenus`, `scripting` and `sidePanel` are new, and host access is now optional.
   - Answer **No** to remote code.
   - Tick no data types, and certify the three statements.
   - Set the privacy policy URL.
4. **Submit for review.** Choose whether to publish as soon as it's approved, or to publish yourself afterwards. Review usually takes a few days.
5. **After it's live:**
   - In a profile that has 0.1.0 installed, open `chrome://extensions` and press **Update**. Check that it says 1.0.0, that no permission prompt appeared, and that the toolbar button opens the side panel.
   - Fix anything the store page shows wrongly.

## Store assets

`pnpm store:assets` rebuilds everything in `store/`:

| Command                  | What it does                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm store:icons`       | Toolbar icons in `public/icon/`, and the 128 px store icon (96 px artwork with 16 px of padding). Source: `store/source/*.svg`. |
| `pnpm store:promo`       | The small promo tile (440×280) and the marquee (1400×560).                                                                      |
| `pnpm store:screenshots` | Builds the extension and takes the five 1280×800 screenshots on the demo page.                                                  |

Rerun them after visible UI changes, so the listing matches the extension.

## Later: Microsoft Edge

The same zip works in Edge. Register in [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview), create a new extension, upload the zip, and reuse the listing text and images.
