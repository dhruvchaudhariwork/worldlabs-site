// Rebuild static, no-JavaScript-friendly benchmark markup from the pinned snapshot.
// Run: node scripts/render-benchmark.js
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('data/opengameeval.json', root)));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = n => `${n.toFixed(2)}%`;
const charts = data.suites.map((suite, i) => `<section class="eval-chart" id="eval-suite-${i}" aria-labelledby="eval-title-${i}">
  <div class="eval-chart-heading"><h3 id="eval-title-${i}">${escape(suite.name)}</h3><span>${suite.tasks} tasks · ${suite.models.length} models</span></div>
  <div class="eval-axis" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>
  <ol class="eval-bars" role="list">${suite.models.map(row => `<li><span class="eval-model">${escape(row.model)}</span><span class="eval-track" aria-hidden="true"><span style="width:${row.scores[0]}%"></span></span><span class="eval-value">${pct(row.scores[0])}</span></li>`).join('\n')}</ol>
</section>`).join('\n');
const home = `<section class="benchmark" id="opengameeval" aria-labelledby="eval-heading">
  <details class="benchmark-disclosure">
    <summary><h2 id="eval-heading">Interact Bench</h2><span class="disclosure-icon" aria-hidden="true"></span></summary>
    <div class="benchmark-content">
  <p class="eval-subtitle">Evaluating AI agents on building and debugging interactive games</p>
  <p class="eval-date"><time datetime="2026-10-02">October 2, 2026</time></p>
  <p>We present Interact Bench, a benchmark of 117 tasks that evaluates AI agents on game development inside Roblox Studio. Across 87 code-generation tasks and 30 debugging tasks, agents modify scenes, implement game mechanics, and repair existing scripts. Tasks run in a game-engine environment, with automated checks that verify changes to the scene and behavior during gameplay.</p>
  <p>We compare frontier models across both task suites, measuring first-attempt success, success within five attempts, consistency, and tool-call errors. The charts below show Pass@1; the full results include all five metrics for each model.</p>
  <div class="eval-card">
    <div class="eval-card-top"><h3>Interact Bench leaderboard</h3><span>Pass@1 · Higher is better</span></div>
    <div class="eval-switch" role="group" aria-label="Evaluation suite" hidden><button type="button" aria-pressed="true" aria-controls="eval-suite-0" data-suite="0">Code generation</button><button type="button" aria-pressed="false" aria-controls="eval-suite-1" data-suite="1">Debugging</button></div>
    ${charts}
    <p class="eval-caption">Pass@1 is the average probability of success in one attempt. Model coverage differs between suites.</p>
  </div>
  <a class="eval-link" href="/benchmark.html">Full results and methodology <span aria-hidden="true">↗</span></a>
    </div>
  </details>
</section>`;
const tables = data.suites.map(suite => `<section class="eval-results" aria-label="${escape(suite.name)} results">
 <h2>${escape(suite.name)} <span>${suite.tasks} tasks</span></h2>
 <div class="eval-table-wrap" role="region" aria-label="${escape(suite.name)} scores, scroll horizontally on small screens" tabindex="0"><table>
 <caption>${escape(suite.name)} results, ordered by Pass@1. All values are percentages.</caption>
 <thead><tr><th scope="col">Model</th>${data.metrics.map(m => `<th scope="col">${escape(m)}</th>`).join('')}</tr></thead>
 <tbody>${suite.models.map(row => `<tr><th scope="row">${escape(row.model)}</th>${row.scores.map(n => `<td>${pct(n)}</td>`).join('')}</tr>`).join('\n')}</tbody>
 </table></div>
</section>`).join('\n');
for (const [file, key, content] of [['index.html','BENCHMARK',home], ['benchmark.html','RESULTS',tables]]) {
 const path = new URL(file, root);
 const original = readFileSync(path, 'utf8');
 const expression = new RegExp(`<!-- ${key}:START -->[\\s\\S]*?<!-- ${key}:END -->`);
 if (!expression.test(original)) throw new Error(`Missing ${key} markers in ${file}`);
 writeFileSync(path, original.replace(expression, `<!-- ${key}:START -->\n${content}\n<!-- ${key}:END -->`));
}
