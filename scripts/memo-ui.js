// Reading progress and section navigation; all research content works without JS.
const progressBar = document.querySelector('.reading-progress');
const contentsLinks = [...document.querySelectorAll('.contents nav a')];
const sections = contentsLinks.map(link => document.querySelector(link.hash));
let framePending = false;
function updateReadingPosition() {
  framePending = false;
  const scrollRange = document.documentElement.scrollHeight - innerHeight;
  const progress = scrollRange > 0 ? Math.min(1, Math.max(0, scrollY / scrollRange)) : 1;
  progressBar.style.transform = `scaleX(${progress})`;
  let current = 0;
  sections.forEach((section, index) => {
    if (section.getBoundingClientRect().top <= innerHeight * .35) current = index;
  });
  contentsLinks.forEach((link, index) => {
    if (index === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
function scheduleReadingPosition() {
  if (!framePending) {
    framePending = true;
    requestAnimationFrame(updateReadingPosition);
  }
}
addEventListener('scroll', scheduleReadingPosition, { passive: true });
addEventListener('resize', scheduleReadingPosition, { passive: true });
updateReadingPosition();
