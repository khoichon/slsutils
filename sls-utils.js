/**

 * SLS Utils — QoL userscript for Student Learning Space

 * Load via bookmarklet (see bookmarklet.txt). Not a cheating tool —

 * just UI/QoL helpers layered on top of the page.

 *

 * Architecture:

 *  - Everything lives in a Shadow DOM root so it never collides with

 *    SLS's own styles/DOM, and SLS updates can't break our UI.

 *  - Features are small self-contained modules registered into

 *    SLSUtils.features. Each has {id, name, enable(), disable()}.

 *  - Settings (which features are on, per-feature prefs) persist in

 *    localStorage so re-running the bookmarklet restores your state.

 */

(function () {

  'use strict';



  // Prevent double-injection if the bookmarklet is clicked twice

  if (window.__SLS_UTILS__) {

    window.__SLS_UTILS__.toast('SLS Utils already loaded');

    return;

  }



  const STORAGE_KEY = 'sls-utils:settings';



  const defaultSettings = {

    features: {

      'video-tweaks': true

    },

    prefs: {

      'video-tweaks': {

        defaultSpeed: 1,

        skipSeconds: 10,

        rememberPosition: true

      }

    },

    menuOpen: false

  };



  function loadSettings() {

    try {

      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) return structuredClone(defaultSettings);

      const parsed = JSON.parse(raw);

      // shallow-merge so new fields added later don't wipe old saves

      return {

        ...structuredClone(defaultSettings),

        ...parsed,

        features: { ...defaultSettings.features, ...(parsed.features || {}) },

        prefs: { ...defaultSettings.prefs, ...(parsed.prefs || {}) }

      };

    } catch (e) {

      console.warn('[SLS Utils] failed to load settings, using defaults', e);

      return structuredClone(defaultSettings);

    }

  }



  function saveSettings() {

    try {

      localStorage.setItem(STORAGE_KEY, JSON.stringify(SLSUtils.settings));

    } catch (e) {

      console.warn('[SLS Utils] failed to save settings', e);

    }

  }



  // ---------------------------------------------------------------------

  // Shadow root + shared UI shell

  // ---------------------------------------------------------------------



  const host = document.createElement('div');

  host.id = 'sls-utils-host';

  host.style.cssText = 'all:initial; position:fixed; z-index:2147483647; bottom:0; right:0;';

  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });



  const style = document.createElement('style');

  style.textContent = `

    :host { all: initial; }

    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }



    .fab {

      position: fixed;

      bottom: 20px;

      right: 20px;

      width: 48px;

      height: 48px;

      border-radius: 50%;

      background: #2563eb;

      color: #fff;

      display: flex;

      align-items: center;

      justify-content: center;

      cursor: pointer;

      box-shadow: 0 2px 10px rgba(0,0,0,.3);

      font-size: 20px;

      user-select: none;

      transition: transform .15s ease;

    }

    .fab:hover { transform: scale(1.08); }



    .panel {

      position: fixed;

      bottom: 78px;

      right: 20px;

      width: 260px;

      background: #1e1e24;

      color: #eee;

      border-radius: 12px;

      box-shadow: 0 4px 24px rgba(0,0,0,.4);

      overflow: hidden;

      display: none;

      font-size: 13px;

    }

    .panel.open { display: block; }



    .panel-header {

      padding: 10px 14px;

      background: #16161b;

      font-weight: 600;

      display: flex;

      justify-content: space-between;

      align-items: center;

    }

    .panel-header small { color: #888; font-weight: 400; }



    .feature-row {

      display: flex;

      align-items: center;

      justify-content: space-between;

      padding: 10px 14px;

      border-top: 1px solid #2a2a32;

    }

    .feature-row span { flex: 1; }



    .switch {

      position: relative;

      width: 36px;

      height: 20px;

      flex-shrink: 0;

    }

    .switch input { opacity: 0; width: 0; height: 0; }

    .slider {

      position: absolute; cursor: pointer; inset: 0;

      background: #444; border-radius: 20px; transition: .15s;

    }

    .slider:before {

      content: ""; position: absolute; width: 14px; height: 14px;

      left: 3px; top: 3px; background: white; border-radius: 50%; transition: .15s;

    }

    input:checked + .slider { background: #2563eb; }

    input:checked + .slider:before { transform: translateX(16px); }



    .toast {

      position: fixed;

      bottom: 78px;

      right: 20px;

      background: #1e1e24;

      color: #eee;

      padding: 8px 14px;

      border-radius: 8px;

      font-size: 12px;

      box-shadow: 0 2px 12px rgba(0,0,0,.4);

      opacity: 0;

      transform: translateY(6px);

      transition: opacity .2s, transform .2s;

      pointer-events: none;

    }

    .toast.show { opacity: 1; transform: translateY(0); }

  `;

  shadow.appendChild(style);



  const fab = document.createElement('div');

  fab.className = 'fab';

  fab.textContent = '⚙';

  fab.title = 'SLS Utils';

  shadow.appendChild(fab);



  const panel = document.createElement('div');

  panel.className = 'panel';

  panel.innerHTML = `

    <div class="panel-header">SLS Utils <small>v1</small></div>

    <div id="feature-list"></div>

  `;

  shadow.appendChild(panel);



  const toastEl = document.createElement('div');

  toastEl.className = 'toast';

  shadow.appendChild(toastEl);



  let toastTimer = null;

  function toast(msg, ms = 2200) {

    toastEl.textContent = msg;

    toastEl.classList.add('show');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);

  }



  fab.addEventListener('click', () => {

    SLSUtils.settings.menuOpen = !SLSUtils.settings.menuOpen;

    panel.classList.toggle('open', SLSUtils.settings.menuOpen);

    saveSettings();

  });



  // ---------------------------------------------------------------------

  // Global namespace

  // ---------------------------------------------------------------------



  const SLSUtils = {

    settings: loadSettings(),

    features: {},

    shadow,

    toast,

    saveSettings,



    registerFeature(feature) {

      this.features[feature.id] = feature;

      this.renderFeatureRow(feature);

      const enabled = this.settings.features[feature.id] !== false;

      if (enabled) feature.enable();

    },



    renderFeatureRow(feature) {

      const list = shadow.getElementById('feature-list');

      const row = document.createElement('div');

      row.className = 'feature-row';

      const enabled = this.settings.features[feature.id] !== false;

      row.innerHTML = `

        <span>${feature.name}</span>

        <label class="switch">

          <input type="checkbox" ${enabled ? 'checked' : ''}>

          <span class="slider"></span>

        </label>

      `;

      const checkbox = row.querySelector('input');

      checkbox.addEventListener('change', () => {

        this.settings.features[feature.id] = checkbox.checked;

        saveSettings();

        if (checkbox.checked) {

          feature.enable();

          toast(`${feature.name} enabled`);

        } else {

          feature.disable();

          toast(`${feature.name} disabled`);

        }

      });

      list.appendChild(row);

    }

  };



  // restore panel open state

  if (SLSUtils.settings.menuOpen) panel.classList.add('open');



  window.__SLS_UTILS__ = SLSUtils;



  // ---------------------------------------------------------------------

  // Feature: Video Tweaks (speed control, skip, remember position)

  // ---------------------------------------------------------------------



  (function registerVideoTweaks() {

    const prefs = SLSUtils.settings.prefs['video-tweaks'];

    // Fallback list only used when a video has no Plyr menu to read real

    // options from (e.g. some non-SLS embed).

    const FALLBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5];



    let enabled = false;

    let observer = null;

    let activeVideo = null;

    const processed = new WeakSet();

    const throttleTimers = new WeakMap();



    // SLS wraps <video class="sls-player"> in Plyr (plyr.io). Plyr renders

    // its own "Speed" submenu as real <button data-plyr="speed" value="X">

    // elements. Driving speed changes by clicking those (instead of just

    // setting video.playbackRate) keeps Plyr's own menu label/checkmarks in

    // sync instead of silently going stale.

    function getPlyrContainer(video) {

      return video.closest('.plyr');

    }



    function getSpeedOptions(container) {

      if (!container) return [];

      return Array.from(container.querySelectorAll('[data-plyr="speed"]'))

        .map((btn) => ({ btn, value: parseFloat(btn.getAttribute('value')) }))

        .filter((o) => !isNaN(o.value))

        .sort((a, b) => a.value - b.value);

    }



    function closestOptionIndex(options, rate) {

      let idx = 0;

      let bestDiff = Infinity;

      options.forEach((o, i) => {

        const diff = Math.abs(o.value - rate);

        if (diff < bestDiff) { bestDiff = diff; idx = i; }

      });

      return idx;

    }



    // dir: -1 (slower) / +1 (faster) / 0 (jump to a specific target)

    function setSpeed(video, dir, target) {

      const container = getPlyrContainer(video);

      const options = getSpeedOptions(container);

      let newRate;

      if (options.length) {

        let idx = closestOptionIndex(options, target != null ? target : video.playbackRate);

        if (dir) idx = Math.min(options.length - 1, Math.max(0, idx + dir));

        options[idx].btn.click(); // let Plyr own the state change

        newRate = options[idx].value;

      } else {

        let idx = FALLBACK_SPEEDS.indexOf(video.playbackRate);

        if (idx === -1) idx = FALLBACK_SPEEDS.indexOf(1);

        if (dir) idx = Math.min(FALLBACK_SPEEDS.length - 1, Math.max(0, idx + dir));

        newRate = target != null && !dir ? target : FALLBACK_SPEEDS[idx];

        video.playbackRate = newRate;

      }

      prefs.defaultSpeed = newRate;

      SLSUtils.saveSettings();

      return newRate;

    }



    function posKey(video) {

      // SLS serves video via blob: URLs which are re-minted every page

      // load/session, so src/currentSrc is useless as a stable id here.

      // SLS instead stamps a stable media-object id on the element itself

      // (index="MO_0", matching the id of the ancestor .media-component

      // div) — prefer that. Fall back to DOM order if it's ever missing.

      const stableId = video.getAttribute('index') || video.dataset.slsUtilsId;

      if (stableId) return `sls-utils:pos:${location.pathname}:${stableId}`;

      const all = Array.from(document.querySelectorAll('video'));

      return `sls-utils:pos:${location.pathname}:vidx-${all.indexOf(video)}`;

    }



    function fmtTime(sec) {

      if (!isFinite(sec)) return '0:00';

      const m = Math.floor(sec / 60);

      const s = Math.floor(sec % 60).toString().padStart(2, '0');

      return `${m}:${s}`;

    }



    function buildOverlay(video) {

      const wrap = document.createElement('div');

      wrap.style.cssText = `

        position: absolute; top: 6px; right: 6px; z-index: 999999;

        display: flex; gap: 4px; align-items: center;

        background: rgba(0,0,0,.65); border-radius: 6px; padding: 4px 6px;

        font: 12px -apple-system, sans-serif; color: #fff; pointer-events: auto;

        transition: opacity .15s;

      `;



      const mkBtn = (label, title) => {

        const b = document.createElement('button');

        b.textContent = label;

        b.title = title;

        b.style.cssText = `

          background: rgba(255,255,255,.12); border: none; color: #fff;

          border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 12px;

        `;

        b.addEventListener('mouseenter', () => b.style.background = 'rgba(255,255,255,.28)');

        b.addEventListener('mouseleave', () => b.style.background = 'rgba(255,255,255,.12)');

        return b;

      };



      const back = mkBtn('«10', `Back ${prefs.skipSeconds}s (J)`);

      const speedLabel = document.createElement('span');

      speedLabel.textContent = video.playbackRate.toFixed(2) + 'x';

      speedLabel.style.cssText = 'min-width:38px; text-align:center;';

      const slower = mkBtn('−', 'Slower (,)');

      const faster = mkBtn('+', 'Faster (.)');

      const fwd = mkBtn('10»', `Forward ${prefs.skipSeconds}s (L)`);



      back.addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - prefs.skipSeconds); });

      fwd.addEventListener('click', () => { video.currentTime = Math.min(video.duration || Infinity, video.currentTime + prefs.skipSeconds); });

      slower.addEventListener('click', () => setSpeed(video, -1));

      faster.addEventListener('click', () => setSpeed(video, 1));



      wrap.append(back, slower, speedLabel, faster, fwd);

      return { wrap, speedLabel };

    }



    function attach(video) {

      if (processed.has(video)) return;

      processed.add(video);



      // position container so overlay can be absolutely placed over it

      const parent = video.parentElement;

      if (parent && getComputedStyle(parent).position === 'static') {

        parent.style.position = 'relative';

      }



      const { wrap, speedLabel } = buildOverlay(video);

      (parent || document.body).appendChild(wrap);



      // keep the label honest regardless of *why* the rate changed —

      // our buttons, our keyboard shortcuts, or the user clicking Plyr's

      // own Settings > Speed menu directly.

      video.addEventListener('ratechange', () => {

        speedLabel.textContent = video.playbackRate.toFixed(2) + 'x';

      });



      // Plyr auto-hides its own controls (class "plyr--hide-controls")

      // during playback/idle. Mirror that on our overlay so it doesn't

      // sit there cluttering an otherwise-clean immersive view, and

      // reveal it again on hover.

      const plyrEl = getPlyrContainer(video);

      if (plyrEl) {

        const syncVisibility = () => {

          const hide = plyrEl.classList.contains('plyr--hide-controls');

          wrap.style.opacity = hide ? '0' : '1';

          wrap.style.pointerEvents = hide ? 'none' : 'auto';

        };

        syncVisibility();

        new MutationObserver(syncVisibility).observe(plyrEl, { attributes: true, attributeFilter: ['class'] });

        wrap.addEventListener('mouseenter', () => { wrap.style.opacity = '1'; wrap.style.pointerEvents = 'auto'; });

      }



      video.addEventListener('mouseenter', () => { activeVideo = video; });

      video.addEventListener('mouseleave', () => { if (activeVideo === video) activeVideo = null; });



      // apply preferred default speed once metadata (and therefore Plyr's

      // menu buttons) are available

      const applySpeed = () => {

        const applied = setSpeed(video, 0, prefs.defaultSpeed || 1);

        speedLabel.textContent = applied.toFixed(2) + 'x';

      };

      if (video.readyState >= 1) applySpeed();

      else video.addEventListener('loadedmetadata', applySpeed, { once: true });



      // restore position

      if (prefs.rememberPosition) {

        const restore = () => {

          try {

            const saved = parseFloat(localStorage.getItem(posKey(video)));

            if (saved && isFinite(saved) && video.duration && saved < video.duration - 5) {

              video.currentTime = saved;

              toast(`Resumed at ${fmtTime(saved)}`);

            }

          } catch (e) { /* ignore */ }

        };

        if (video.readyState >= 1) restore();

        else video.addEventListener('loadedmetadata', restore, { once: true });



        video.addEventListener('timeupdate', () => {

          if (throttleTimers.get(video)) return;

          throttleTimers.set(video, setTimeout(() => throttleTimers.delete(video), 3000));

          try { localStorage.setItem(posKey(video), String(video.currentTime)); } catch (e) { /* ignore */ }

        });



        video.addEventListener('ended', () => {

          try { localStorage.removeItem(posKey(video)); } catch (e) { /* ignore */ }

        });

      }

    }



    function scan(root) {

      (root.querySelectorAll ? root.querySelectorAll('video.sls-player, video') : []).forEach(attach);

      // best-effort into same-origin iframes (SLS's own YouTube embeds are

      // cross-origin iframes and are intentionally left untouched)

      (root.querySelectorAll ? root.querySelectorAll('iframe') : []).forEach((f) => {

        try {

          const doc = f.contentDocument;

          if (doc) scan(doc);

        } catch (e) { /* cross-origin, skip */ }

      });

    }



    function onKeydown(e) {

      if (!activeVideo) return;

      const tag = (e.target && e.target.tagName || '').toLowerCase();

      if (tag === 'input' || tag === 'textarea') return;



      switch (e.key.toLowerCase()) {

        case 'j':

          activeVideo.currentTime = Math.max(0, activeVideo.currentTime - prefs.skipSeconds);

          e.preventDefault();

          break;

        case 'l':

          activeVideo.currentTime = Math.min(activeVideo.duration || Infinity, activeVideo.currentTime + prefs.skipSeconds);

          e.preventDefault();

          break;

        case 'k':

        case ' ':

          activeVideo.paused ? activeVideo.play() : activeVideo.pause();

          e.preventDefault();

          break;

        case ',':

          setSpeed(activeVideo, -1);

          break;

        case '.':

          setSpeed(activeVideo, 1);

          break;

      }

    }



    const feature = {

      id: 'video-tweaks',

      name: 'Video tweaks (speed / skip / resume)',

      enable() {

        if (enabled) return;

        enabled = true;

        scan(document);

        observer = new MutationObserver((mutations) => {

          for (const m of mutations) {

            m.addedNodes.forEach((node) => {

              if (node.nodeType !== 1) return;

              if (node.tagName === 'VIDEO') attach(node);

              else scan(node);

            });

          }

        });

        observer.observe(document.documentElement, { childList: true, subtree: true });

        document.addEventListener('keydown', onKeydown, true);

      },

      disable() {

        enabled = false;

        if (observer) observer.disconnect();

        document.removeEventListener('keydown', onKeydown, true);

        // note: overlays already injected are left in place until reload,

        // simplest safe behavior since videos may be re-scanned live

      }

    };



    SLSUtils.registerFeature(feature);

  })();



  toast('SLS Utils loaded');

})();
