// Homepage interactions: local form feedback and controllable decorative motion.
(() => {
  const form = document.getElementById('waitlist-form');
  const email = document.getElementById('waitlist-email');
  const button = document.getElementById('waitlist-btn');
  const message = document.getElementById('waitlist-msg');
  if (form && email && button && message) {
    let pending = false;
    let complete = false;
    email.addEventListener('input', () => {
      email.removeAttribute('aria-invalid');
      message.textContent = '';
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (pending || complete) return;
      email.value = email.value.trim();
      if (!email.validity.valid || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value)) {
        email.setAttribute('aria-invalid', 'true');
        message.textContent = 'Enter a valid email address.';
        email.focus();
        return;
      }
      pending = true;
      button.disabled = true;
      email.readOnly = true;
      button.textContent = 'Joining…';
      form.setAttribute('aria-busy', 'true');
      message.textContent = 'Saving your email…';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch('/api/waitlist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.value }), signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.ok !== true) {
          const detail = response.status === 429
            ? 'Too many attempts. Please wait a few minutes before trying again.'
            : typeof result?.error === 'string' ? result.error : 'We could not confirm your signup. Please try again.';
          throw new Error(detail);
        }
        complete = true;
        email.readOnly = true;
        button.textContent = 'Joined';
        message.textContent = 'You’re on the list. We’ll email you when new projects open.';
      } catch (error) {
        message.textContent = error.name === 'AbortError'
          ? 'This is taking longer than expected. Please try again.'
          : error instanceof TypeError ? 'Could not connect. Check your connection and try again.' : error.message;
        button.disabled = false;
        button.textContent = 'Join the Waitlist';
      } finally {
        clearTimeout(timer);
        pending = false;
        if (!complete) email.readOnly = false;
        form.removeAttribute('aria-busy');
      }
    });
    button.disabled = false;
  }

  const video = document.getElementById('hero-video');
  const toggle = document.getElementById('video-toggle');
  if (!video || !toggle) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let requestedPlayback = !motion.matches;
  let menuOpen = false;
  let inView = true;
  video.muted = true;
  toggle.hidden = false;

  function reflectPlayback() {
    toggle.dataset.paused = String(video.paused);
    toggle.textContent = video.paused ? 'Play background' : 'Pause background';
  }
  function syncPlayback() {
    if (requestedPlayback && !menuOpen && !document.hidden && inView) {
      video.play().catch(reflectPlayback);
    } else {
      video.pause();
    }
    reflectPlayback();
  }
  video.addEventListener('play', reflectPlayback);
  video.addEventListener('pause', reflectPlayback);
  toggle.addEventListener('click', () => {
    requestedPlayback = video.paused;
    syncPlayback();
  });
  motion.addEventListener('change', () => {
    requestedPlayback = !motion.matches;
    syncPlayback();
  });
  document.addEventListener('site:menu-change', (event) => {
    menuOpen = Boolean(event.detail?.open);
    syncPlayback();
  });
  document.addEventListener('visibilitychange', syncPlayback);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncPlayback();
    }, { threshold: 0 }).observe(video);
  }
  video.addEventListener('error', () => { toggle.hidden = true; });
  syncPlayback();
})();
