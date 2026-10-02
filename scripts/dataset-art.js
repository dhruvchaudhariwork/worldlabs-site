// Animate only visible illustrations; the SVGs also work as static artwork.
(() => {
  const cards = [...document.querySelectorAll('.ds-card')];
  if (!cards.length) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const visible = new Map(cards.map(card => [card, !('IntersectionObserver' in window)]));
  let menuOpen = false;

  function sync() {
    for (const card of cards) {
      card.classList.toggle('ds-is-playing', visible.get(card) && !document.hidden && !motion.matches && !menuOpen);
    }
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) visible.set(entry.target.closest('.ds-card'), entry.isIntersecting);
      sync();
    }, { threshold: 0 });
    cards.forEach(card => observer.observe(card.querySelector('.ds-art')));
  }
  motion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('site:menu-change', event => {
    menuOpen = Boolean(event.detail?.open);
    sync();
  });
  window.addEventListener('pageshow', sync);
  sync();
})();
