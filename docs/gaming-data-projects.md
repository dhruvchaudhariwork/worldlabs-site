# Gaming data projects

Updated September 8, 2026 following the founder's clarification. These are proposed offerings and illustrative assignments, not existing customer work or available datasets.

## Positioning

**Expert gaming datasets for AI training and evaluation.** Game specialists create prompts, critique outputs, compare alternatives, and improve designs across gaming subjects, genres, and styles.

Taste Labs is a useful operating-model reference. Its [creative brief and critique project](https://portal.tastelabs.com/jobs/a1b2c3d4-0000-4000-8000-000000000001?position=a1b2c3d4-0000-4000-8000-000000000002) explicitly describes prompt creation, evaluation, iteration, and preference ranking. Its [voting project](https://portal.tastelabs.com/jobs/d438114b-7863-4bf2-b6bd-05588cc7c80d?position=0f1f5c20-277e-4aed-a889-9ade5d31e4d6) asks designers to judge outputs and provide a rationale. This supports a community organized around distinct expert-data assignments.

[Amplify's June 16, 2026 announcement](https://www.amplifypartners.com/blog-posts/kill-the-slop-announcing-our-investment-in-taste) describes an $18.5M seed round and a business spanning preference datasets, reasoning data, rubrics, and evaluation environments. That is evidence of investor backing and stated product scope, not independently verified revenue or unit economics.

Taste's [contributor portal](https://portal.tastelabs.com/) already lists games among its creative areas. Gaming is therefore a specialization to execute deeply, not a claim to an uncontested category. Depth in interactive systems, specialist recruitment, evidence quality, and customer-specific coverage can distinguish the offering.

## Organize datasets by three dimensions

1. **Subject:** combat, economy, progression, level design, narrative, NPC behavior, UI/onboarding, game feel, art direction, audio.
2. **Context:** genre, platform, intended audience, skill level, session length, design goals, visual style, and constraints. Avoid encoding “good” as one universal style.
3. **Task:** author a prompt, produce a demonstration, evaluate an output, compare outputs, revise an artifact, or build a rubric.

For example: economy × cozy farming sim × critique is a different collection from economy × competitive strategy × pairwise preference. An art-style prompt and a playable-combat comparison need different evidence and reviewers.

## Example project menu

| Project | Expert assignment | Delivered data |
| --- | --- | --- |
| One-shot combat prompts | Write a self-contained arena-combat brief with three weapons, readable counterplay, controls, constraints, and intended experience. | Prompt, context tags, required behaviors, expert rationale, review status. |
| Economy critique | Review a cozy crafting economy's tables and dependency graph. Locate grind, unreachable recipes, or resource inflation under stated assumptions. | Source artifact, criterion labels, calculations/evidence, issue severity, critique, proposed corrections. |
| Combat A/B preferences | Play two prototypes for the same short-duel brief. Compare telegraphing, recovery windows, feedback, and meaningful counterplay. | Artifact pair, shared brief, choice/tie/abstention, confidence, rationale, evidence references. |
| Economy A/B preferences | Compare two roguelite upgrade systems under the same 20-minute-run assumptions. Explain variety versus dominant purchases. | Paired economy definitions, assumptions, preference, calculations or play observations, tradeoffs. |
| Level demonstrations and revisions | Create or revise a puzzle level that teaches a mechanic without text while preserving solvability. | Brief, original/revised artifacts, expert changes, rationale, verification evidence. |
| Narrative evaluations | Compare quest dialogue for a grounded mystery versus a comedic RPG, judged against each intended tone. | Contextual ratings or preferences, continuity issues, rationale, suggested rewrites. |
| UI and art-direction prompts | Author briefs across pixel-art, stylized 3D, and realistic styles while specifying readability and platform constraints. | Expert briefs, reference permissions, style tags, evaluation criteria; demonstrations if separately commissioned. |

“One-shot” describes one complete initial prompt. It does not guarantee a successful first generation. Prompts alone are task inputs; supervised fine-tuning examples also need appropriate target outputs. Pairwise preferences can support preference optimization or reward-model development, depending on the buyer's pipeline. None of these alone constitutes an RL environment.

## Make the judgment usable

For an A/B project, capture the common brief; subject and context; artifact versions and tool provenance; evidence reviewed; randomized presentation order; choice including ties or insufficient evidence; criterion-level tradeoffs; rationale; confidence; contributor specialty; and review outcome. Keep contributor identity separate from customer-facing exports.

Require playable evidence for control feel. Documents or spreadsheets may support structural economy judgments; long-term balance claims need simulation or play evidence. Do not infer retention, revenue, or audience demand from expert preference alone.

Calibrate reviewers on examples, double-review a defined sample, preserve substantive disagreement, and audit whether rationales cite actual evidence. A qualified minority may identify a real flaw. Align rates, confidentiality, ownership, and training rights before assignments.

## First commercial project

A plausible starting offer is “combat-design preference data for your game-generation model,” scoped to one brief family and intended audience. Another is an expert prompt collection spanning a buyer-agreed coverage matrix. Choose with a buyer; no arbitrary dataset size or price is assumed here.

Agree a sample deliverable and acceptance criteria first, then commission the collection. Track usable-record rate, review/rework time, coverage, buyer acceptance, and downstream usefulness. Reserve distinct task families and derivative artifacts for evaluation rather than leaking near-duplicates across training and test sets.

The public site keeps this broader model concise: four example dataset directions on the homepage, a short research page, and a contributor overview. The examples are not an exhaustive catalog. The benchmark page is an "In progress" placeholder, and the blog pages have been removed.

Prompt collection, paired-artifact assignment, contributor authoring, project payments, and dataset export are still to be implemented. The existing form gathers contributor interest; example cards are not live job listings.
