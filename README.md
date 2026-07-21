# SLS Utils



QoL bookmarklet for the Student Learning Space (SLS) portal. Not a cheating tool —

it only adjusts playback UI (speed / skip / resume), nothing about answers or content.



## How it works



- `sls-utils.js` builds a floating ⚙ button in a **Shadow DOM** root, so it can't

  collide with SLS's own CSS/DOM and won't break if SLS changes their markup.

- Click the ⚙ to open a panel with per-feature toggles (state persists in

  `localStorage`).

- Features register themselves into `window.__SLS_UTILS__.features`, so adding a

  new feature later (nav shortcuts, UI cleanup, etc.) is just another

  `SLSUtils.registerFeature({...})` block at the bottom of the file.



## Feature 1: Video tweaks



- Finds `<video>` elements on the page (and reachable same-origin iframes) as

  they appear, via `MutationObserver`.

- Small overlay in the corner of each video: `«10` / speed `−` `+` / `10»`.

- Keyboard shortcuts while hovering a video: `J`/`L` skip ±10s, `K`/`Space`

  play-pause, `,`/`.` slower/faster.

- Remembers playback position per page + video src in `localStorage`, and

  resumes automatically (skips resume if within last 5s of the video, so it

  doesn't loop you right before the end).

- Preferred speed carries over to the next video you watch.



## Setup



1. Push `sls-utils.js` to a public GitHub repo (e.g. `khoichon/sls-utils`,

   branch `main`, file at repo root). jsdelivr serves any public GitHub repo

   automatically — no GitHub Pages needed.

2. Create a new browser bookmark, paste the contents of `bookmarklet.txt` as

   the URL. **Edit the `khoichon/sls-utils@main` part** in it to match your

   actual `user/repo@branch`.

3. On any SLS page, click the bookmark. The ⚙ button appears bottom-right.



### About the jsdelivr cache



jsdelivr caches files at the edge for a while (hours to ~7 days depending on

type), and it **ignores query strings for cache-busting** — appending

`?t=Date.now()` like a raw GitHub Pages URL would need does nothing here.

The bookmarklet instead calls jsdelivr's purge endpoint

(`purge.jsdelivr.net/gh/...`) and waits for it before injecting the script,

so each click pulls a reasonably fresh copy. Purges aren't instant across

all edge nodes, so if you just pushed a change and it's still not showing

up, give it a few seconds and click the bookmark again — or hit

`https://purge.jsdelivr.net/gh/khoichon/sls-utils@main/sls-utils.js`

directly in a new tab first.



If you want zero cache surprises while actively developing, point the

bookmarklet at a commit hash instead of `@main` (jsdelivr treats pinned

commits as immutable and skips caching weirdness entirely) — just update the

hash each time you push, or use `@main` for normal use and swap in a commit

hash only during a debugging session.



Because it's a bookmarklet (not a Tampermonkey script), it only runs when you

click it — nothing persists across page loads except your saved

settings/positions in `localStorage`. If SLS is a single-page app and

navigating between lessons doesn't reload the page, you likely won't need to

re-click it each time; if it does full page reloads, just click the bookmark

again.



## Extending later



Bottom of `sls-utils.js` is the pattern to copy for new features:



```js

SLSUtils.registerFeature({

  id: 'my-feature',

  name: 'Human readable name',

  enable() { /* wire up listeners/DOM */ },

  disable() { /* tear down */ }

});

```
