# Positioning review — September 8, 2026

## Recommendation, revised after founder clarification

Lead with **expert gaming datasets for AI training and evaluation**. Build a network of game specialists who contribute to distinct projects: prompt authoring, demonstrations, critique, preference comparisons, and revisions. Cover subjects such as combat, economies, progression, levels, narrative, UI, and art direction, with explicit genre, audience, platform, and style context.

The earlier recommendation narrowed the company too far into a private playtesting service. Domain specialization can support a business even when broad providers offer similar task formats. The right question is how well this company sources gaming expertise and turns it into useful, differentiated data. Datasets belong in the core offering; operational RL infrastructure remains a separate implementation commitment.

Suggested pitch: "We are building expert gaming datasets for AI. Game specialists write prompts, critique outputs, and explain preferences across combat, economies, levels, and more, with projects tailored to different genres and styles."

See [gaming-data-projects.md](gaming-data-projects.md) for the updated project model and examples. The implementation findings below remain relevant to the experimental scoring backend.

## Competitive context

Sources below are first-party pages or author-posted papers checked September 8, 2026. Vendor descriptions establish positioning, not independently verified performance. This is a focused comparison, not an exhaustive market census.

| Comparator | What it describes | Implication for this company |
| --- | --- | --- |
| [Scale RL Environments](https://scale.com/rlenvironments) | Simulated applications, verifiers, expert-designed objectives, reset control, trajectories and rewards. | Calling something an RL environment creates concrete infrastructure expectations. A scorecard database is insufficient. |
| [Toloka Arena offerings](https://toloka.ai/arena-pricing) | Automatic and human-reviewed evaluation, datasets, and bespoke RL gyms. | Evals + experts + datasets already coexist in the market. Specify the game-development decision the first service improves. |
| [Mechanize](https://www.mechanize.work/announcing-mechanize-inc/) | Virtual work environments, benchmarks and training data for complex work. | Long-horizon environments are a crowded broad thesis. A focused game task is more legible. |
| [Bespoke Labs](https://bespokelabs.ai/) | Environment infrastructure for agent training and evaluation. | Avoid competing in general environment infrastructure before showing a domain advantage. |
| [Scale Remote Labor Index](https://labs.scale.com/leaderboard/rli) | Expert assessment of professional project outputs, including artifacts whose quality is difficult to automate. | Expert assessment of complex creative work is not itself unique. |
| [PlaytestCloud expert services](https://help.playtestcloud.com/en/articles/3745698-getting-expert-help-for-your-playtest) | Professional playtest design, analysis and reporting by games user research specialists. | The old “marketplaces sell volume; we sell judgment” claim was misleading. Compare against existing expert services, too. |
| [GameDevBench](https://arxiv.org/abs/2602.11103) | Game-development evaluation using 333 tutorial-derived tasks; first submitted February 11, 2026, revised June 30. | Do not imply that evaluating game-building agents is new or unserved. |
| [GameXpert-Bench](https://arxiv.org/abs/2608.21833) | Generation, bug repair and multi-turn optimization tracks, using live interaction, behavioral tests and product criteria; submitted August 22, 2026. | This is close overlap with the original generation/iteration pitch. A proprietary workflow and evidence of useful expert feedback need to distinguish the business. |

My inference: the opportunity to test is whether specialist feedback on game mechanics and design helps a generation-tool team make better release or training decisions than its existing automated tests, model judges, and playtests. The search does not establish that this opportunity is unoccupied.

## Terminology and claims corrected

- **Evaluation versus RL:** judging an artifact measures it. RL requires a policy-learning process using rewards from interactions; an environment supplier need not train a model itself, but should expose the task, observations/actions, transitions, reset/termination behavior, reward interface, and integration contract.
- **Human feedback versus training-ready data:** numeric ratings, pairwise choices, and critiques are distinct data types. Critique supervision alone is not RLAIF. Dataset usefulness requires a defined consumer, permissions, consistent formats, validation, and held-out evaluation.
- **Automated checks versus taste:** some game properties are verifiable; compile/boot, explicit rule checks, and reproducible failures can be automated. Expert judgment complements these checks. It does not automatically predict enjoyment, retention, or market demand.
- **Scale consistency:** the earlier site mixed 1–7, 5/7, seven dimensions, and fourteen categories, while the backend accepts 0–10. The public site no longer presents scorecards or ranks. Any future scoring workflow still needs consistent scales and validated anchors. Pairwise preference is separate from quality dimensions.
- **Operating status:** removed claims of active environments, deterministic dual builds, enforced play time, operational blind assignment, ready datasets, and validated rankings. These capabilities are not established by this repository or the user's idea-stage description.
- **Expert supply:** removed guaranteed work, monthly payment schedules, a one-week response promise, and existing community benefits. Pilot scope and payment terms now precede assignments.

## Repository findings that need product work

The initial inspection covered the public marketing pages, the two blog posts that have since been removed, README, schema, ingest and leaderboard handlers, waitlist endpoint, and existing tests. No production database or private customer evidence was inspected.

| Finding | Evidence | Action before making the claim |
| --- | --- | --- |
| No implemented RL environment or complete eval harness found | Repository is a static site with applications, waitlist, admin review and scorecard ingestion | Build one repeatable task workflow before advertising operational environment infrastructure. |
| Play time and reviewer authorship are not verified | `api/benchmark/ingest.js` accepts admin-submitted email, optional comment and supplied minutes | Authenticate reviewers, preserve artifacts/session evidence, and define review controls. A stored email is not proof of authorship. |
| Quorum is model-wide | `api/benchmark/leaderboard.js` checks three distinct panelists across all runs | Require adequate coverage per reported run/dimension. Independence needs a review process, not just distinct IDs. |
| SQL aggregation is incorrect for the claimed method | `sql/001_init.sql` joins scorecards to per-run category medians before rollup | Separate run/category summaries from scorecard counts. Current join weights medians by scorecard count, inflates counts, and overwrites duplicate category keys instead of averaging categories across runs. |
| Partial categories and different task mixes can distort comparisons | Partial scorecards accepted; no balanced task-set publication requirement | Predefine the cohort, missingness policy, weighting, failure treatment and uncertainty method. |
| “View nobody can manipulate” was false | Administrators can alter source scorecards; service-role access bypasses row policies | Use audit history and disclosed governance. A view does not establish scientific integrity or prevent bought placements. |
| Pairwise and critique claims exceeded the schema | Numeric ratings and an optional comment, without an explicit comparison/choice record | Define same-task pairing, randomized order, ties/abstentions, rationale and validation before selling preference data. |
| Homepage discarded signup emails | `index.html` previously displayed success without a request | Fixed locally to call the existing waitlist endpoint and display success only after acknowledgement. |

The public benchmark page now shows a white "In progress" screen, an animated hourglass, and a link home. It does not fetch ranks or present methodology. **The experimental leaderboard API and SQL remain in the repository.** The public-page changes do not make the backend publication-ready or disable its endpoint. Existing tests use a fake database and do not validate real PostgreSQL aggregation.

## What to show and what to hold back

Show the domain expertise, project formats, example assignments, and intended dataset consumers. The homepage presents four concise, illustrated dataset directions in a responsive grid, followed by a custom-project invitation. The research page briefly explains authoring, evaluation, and comparison. Detailed assignment ideas remain in the internal project outline. Contributor messaging includes authors and reviewers. Blog pages and blog navigation have been removed.

Keep examples marked as in development until commissioned. Avoid claiming a completed dataset catalog, established customer outcomes, operating training infrastructure, or a validated benchmark. The existing scorecard backend does not yet implement the expanded project workflow.

## Decisions for the first projects

Choose a dataset buyer and subject for the first commissioned project without restricting the whole company to that subject. Agree the deliverable schema, intended training/evaluation use, evidence requirements, contributor qualifications, review procedure, data rights, and acceptance criteria. Then use completion cost, buyer acceptance, and downstream usefulness to decide what to repeat or expand.

A public benchmark can be one output of separate evaluation projects. It does not need to be the primary product or launch requirement for prompt and preference datasets.

## Naming

[World Labs](https://www.worldlabs.ai/about) is already the name of Fei-Fei Li's spatial AI company, whose products concern generated 3D worlds. The identical name and adjacent domain create a material positioning and discoverability problem. I recommend choosing a distinct name before wider outreach. No automatic rename was made; this is a founder decision, not a legal determination.

## Validation from the initial positioning pass

The initial positioning pass recorded 64 passing tests and Chromium smoke checks on nine pages at 1440px and 390px widths, including the research taxonomy that was later removed. The homepage signup passed success, server-error, and retry checks against the local in-memory demo; no JavaScript page errors were observed. External media/font requests were blocked for that check, so it did not verify remote asset availability. These are historical results for that version, not validation of subsequent UI changes. They do not establish production delivery, reviewer independence, scientific validity, or a functioning RL training loop.
