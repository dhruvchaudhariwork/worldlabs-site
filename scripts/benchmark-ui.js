// Progressive enhancement: both suites remain readable when JavaScript is off.
const switcher = document.querySelector('.eval-switch');
if (switcher) {
  const buttons = [...switcher.querySelectorAll('button')];
  const charts = [...document.querySelectorAll('.eval-chart')];
  function select(suite) {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.suite === suite)));
    charts.forEach((chart, i) => { chart.hidden = String(i) !== suite; });
  }
  buttons.forEach(button => button.addEventListener('click', () => select(button.dataset.suite)));
  select('0');
  switcher.hidden = false;
}
