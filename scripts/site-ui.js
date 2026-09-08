/* Shared keyboard and navigation behavior. The floating header keeps its layout. */
(function () {
  function initialize() {
    if (document.documentElement.dataset.siteUi === 'ready') return;
    document.documentElement.dataset.siteUi = 'ready';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const main = document.querySelector('main, [role="main"]');
    const button = document.getElementById('mk-menu-btn');
    const label = document.getElementById('mk-menu-label');
    const overlay = document.getElementById('mk-overlay');
    const navigation = button?.closest('.mk-nav');
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let menuOpen = false;
    let shell;
    let previousFocus;
    let restoreScroll;
    let inertElements = [];

    function focusContent(target) {
      const temporaryTabindex = !target.hasAttribute('tabindex');
      if (temporaryTabindex) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      if (temporaryTabindex) {
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
    }

    if (main && !document.querySelector('.site-skip-link')) {
      if (!main.id) main.id = 'main-content';
      const skip = document.createElement('a');
      skip.className = 'site-skip-link';
      skip.href = '#' + main.id;
      skip.textContent = 'Skip to content';
      document.body.prepend(skip);
    }

    function lockBackground() {
      // Retain each original inert state, including unrelated dialogs or panels.
      for (let branch = shell; branch && branch !== document.body; branch = branch.parentElement) {
        for (const sibling of branch.parentElement.children) {
          if (sibling === branch || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) continue;
          inertElements.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
      }

      const x = window.scrollX;
      const y = window.scrollY;
      const body = document.body;
      const properties = ['position', 'top', 'left', 'width', 'overflow'];
      const original = properties.map(name => [name, body.style.getPropertyValue(name), body.style.getPropertyPriority(name)]);
      const root = document.documentElement;
      const rootOverflow = [root.style.getPropertyValue('overflow'), root.style.getPropertyPriority('overflow')];
      root.style.setProperty('overflow', 'hidden');
      body.style.setProperty('position', 'fixed');
      body.style.setProperty('top', -y + 'px');
      body.style.setProperty('left', -x + 'px');
      body.style.setProperty('width', '100%');
      body.style.setProperty('overflow', 'hidden');

      restoreScroll = () => {
        for (const [name, value, priority] of original) {
          if (value) body.style.setProperty(name, value, priority);
          else body.style.removeProperty(name);
        }
        if (rootOverflow[0]) root.style.setProperty('overflow', ...rootOverflow);
        else root.style.removeProperty('overflow');
        window.scrollTo({ left: x, top: y, behavior: 'instant' });
      };
    }

    function menuItems() {
      return [...shell.querySelectorAll(focusableSelector)].filter(element => {
        return !element.closest('[inert]') && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
      });
    }

    function setMenu(open, restoreFocus = true) {
      if (!shell || menuOpen === open) return;
      menuOpen = open;
      button.dataset.open = String(open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
      if (label) label.textContent = open ? 'Close' : 'Menu';

      if (open) {
        previousFocus = document.activeElement;
        shell.setAttribute('role', 'dialog');
        shell.setAttribute('aria-modal', 'true');
        shell.setAttribute('aria-label', 'Site navigation');
        overlay.inert = false;
        overlay.removeAttribute('aria-hidden');
        overlay.classList.add('open');
        lockBackground();
        (overlay.querySelector('a[href]') || button).focus({ preventScroll: true });
      } else {
        inertElements.forEach(([element, wasInert]) => { element.inert = wasInert; });
        inertElements = [];
        restoreScroll?.();
        restoreScroll = null;
        shell.removeAttribute('role');
        shell.removeAttribute('aria-modal');
        shell.removeAttribute('aria-label');
        // Move focus out before hiding the focused link from assistive technology.
        if (restoreFocus || overlay.contains(document.activeElement)) {
          const target = restoreFocus && previousFocus?.isConnected ? previousFocus : button;
          target.focus({ preventScroll: true });
        }
        overlay.inert = true;
        overlay.setAttribute('aria-hidden', 'true');
        overlay.classList.remove('open');
      }
      document.dispatchEvent(new CustomEvent('site:menu-change', { detail: { open } }));
    }

    if (button && overlay && navigation && navigation.parentElement === overlay.parentElement) {
      // Group existing siblings semantically, without introducing a layout box.
      // The original menu toggle and header links remain inside the open dialog.
      shell = document.createElement('div');
      shell.className = 'site-menu-shell';
      navigation.before(shell);
      shell.append(navigation, overlay);
      navigation.setAttribute('aria-label', 'Main navigation');
      overlay.setAttribute('role', 'navigation');
      overlay.setAttribute('aria-label', 'Explore World Labs');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.inert = true;
      overlay.classList.remove('open');
      button.dataset.open = 'false';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', overlay.id);
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-label', 'Open navigation menu');
      navigation.querySelectorAll('.mk-logo').forEach(logo => logo.setAttribute('aria-label', 'World Labs home'));
      navigation.querySelectorAll('svg').forEach(svg => svg.setAttribute('aria-hidden', 'true'));
      overlay.querySelectorAll('.mk-overlay-num').forEach(number => number.setAttribute('aria-hidden', 'true'));

      button.addEventListener('click', () => setMenu(!menuOpen));
      document.addEventListener('keydown', event => {
        if (!menuOpen) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          setMenu(false);
        } else if (event.key === 'Tab') {
          const items = menuItems();
          const index = items.indexOf(document.activeElement);
          if (event.shiftKey && index <= 0) {
            event.preventDefault();
            items.at(-1)?.focus();
          } else if (!event.shiftKey && (index === -1 || index === items.length - 1)) {
            event.preventDefault();
            items[0]?.focus();
          }
        }
      });
      document.addEventListener('focusin', event => {
        if (menuOpen && !shell.contains(event.target)) button.focus({ preventScroll: true });
      });
      window.addEventListener('pagehide', () => setMenu(false, false));
    }

    function pagePath(path) {
      return path.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/$/, '') || '/';
    }

    document.addEventListener('click', event => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      const href = anchor.getAttribute('href');
      let destination;
      try { destination = new URL(href, location.href); } catch { return; }

      if (menuOpen && shell.contains(anchor)) setMenu(false, false);
      if (!href.includes('#') || destination.origin !== location.origin || pagePath(destination.pathname) !== pagePath(location.pathname) || destination.search !== location.search) return;
      let id;
      try { id = decodeURIComponent(destination.hash.slice(1)); } catch { return; }
      const target = id ? document.getElementById(id) : main;
      if (id && !target) return;

      event.preventDefault();
      // Save the old entry's position before moving, so Back restores it.
      const nextHash = destination.hash;
      if (location.hash !== nextHash) history.pushState(null, '', location.pathname + location.search + nextHash);
      const behavior = reducedMotion.matches ? 'instant' : 'smooth';
      if (id) target.scrollIntoView({ behavior, block: 'start' });
      else window.scrollTo({ top: 0, behavior });
      if (target) focusContent(target);
    });

    window.addEventListener('popstate', () => {
      if (menuOpen) setMenu(false, false);
      let id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
      const target = id ? document.getElementById(id) : main;
      // The browser restores scroll position; only align the keyboard focus.
      if (target) focusContent(target);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
