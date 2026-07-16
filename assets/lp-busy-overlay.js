/**
 * Full-screen busy overlay for long partner-console operations (save, AI demo generation).
 * Usage:
 *   LPBusy.show({ title: 'Saving…', message: 'Updating your page' });
 *   LPBusy.update({ message: 'Almost done…' });
 *   LPBusy.hide();
 */
(function (global) {
  var root = null;
  var depth = 0;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensureRoot() {
    if (root) return root;
    root = document.createElement('div');
    root.id = 'lp-busy-overlay';
    root.className = 'lp-busy-overlay hidden';
    root.setAttribute('role', 'alertdialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-live', 'polite');
    root.innerHTML =
      '<div class="lp-busy-card">'
      + '<div class="lp-busy-spinner" aria-hidden="true"></div>'
      + '<div class="lp-busy-title" id="lp-busy-title"></div>'
      + '<div class="lp-busy-message" id="lp-busy-message"></div>'
      + '<div class="lp-busy-detail hidden" id="lp-busy-detail"></div>'
      + '</div>';
    document.body.appendChild(root);
    return root;
  }

  function setText(id, text, hideIfEmpty) {
    var el = document.getElementById(id);
    if (!el) return;
    var val = String(text || '').trim();
    if (!val) {
      if (hideIfEmpty) el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    el.textContent = val;
    if (hideIfEmpty) el.classList.remove('hidden');
  }

  function apply(opts) {
    opts = opts || {};
    ensureRoot();
    if (opts.title != null) setText('lp-busy-title', opts.title, true);
    if (opts.message != null) setText('lp-busy-message', opts.message, false);
    if (opts.detail != null) setText('lp-busy-detail', opts.detail, true);
  }

  function show(opts) {
    depth++;
    apply(opts || {});
    ensureRoot().classList.remove('hidden');
    document.body.classList.add('lp-busy-active');
    return { hide: hide };
  }

  function update(opts) {
    if (!depth) return;
    apply(opts || {});
  }

  function hide() {
    if (!depth) return;
    depth--;
    if (depth > 0) return;
    if (root) root.classList.add('hidden');
    document.body.classList.remove('lp-busy-active');
  }

  function forceHide() {
    depth = 0;
    if (root) root.classList.add('hidden');
    document.body.classList.remove('lp-busy-active');
  }

  async function run(task, opts) {
    show(opts);
    try {
      return await task({
        update: update
      });
    } finally {
      hide();
    }
  }

  global.LPBusy = {
    show: show,
    update: update,
    hide: hide,
    forceHide: forceHide,
    run: run
  };
})(typeof window !== 'undefined' ? window : global);
