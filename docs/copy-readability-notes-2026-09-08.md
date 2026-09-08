# Copy and readability pass

## Updated pages

- `community.html`: shortened the FAQ, broadened contribution language beyond scores and reviews, and clarified that the displayed assignments are examples. Payment and availability copy describe planned projects, with terms provided before acceptance. The community layout and floating header are retained.
- `research.html`: replaced old eval-only labels with dataset language; corrected a visible punctuation error; explained authoring, evaluation, and comparison with direct verbs. A compact, neutral custom-dataset invitation replaces the video banner. The page includes a main landmark and a short project-status note.
- `README.md`: updated setup instructions for Node and Windows, corrected the environment-variable count, explained demo persistence, and documented the current pages. Removed stale deployment-plan limits and hardcoded test counts.
- Internal positioning notes: corrected the homepage grid, removed-blog, and benchmark-placeholder descriptions. Results from the initial positioning pass are explicitly historical.

## Checks

Focused Chromium checks against the local demo passed for community and research at 320, 390, 768, and 1440 pixels: no horizontal overflow, one main landmark, one H1, and no JavaScript page errors. Community FAQ items opened and closed using the Enter key. Mobile research and desktop community screenshots were visually inspected. These checks do not verify production form persistence.

A second pass inspected rendered copy and text attributes across the homepage, community, research, application, waitlist, privacy, and terms pages. No broken character entities or corrupted characters within words were found. A homepage CTA arrow and the paused-video icon contained literal question marks; these were reported to the homepage owner and corrected. No removed blog URLs remain in the root HTML links, form actions, or resources.

After the shared footer adjustment, the contact email fits on one line at both 320 and 390 pixels on the homepage, community, research, application, and waitlist pages. No horizontal overflow was observed in those ten combinations.

## Handoff

- Both updated pages expose `main#main-content` for the shared skip link. Shared navigation and readable expert-page CSS have been integrated.
- The footer contact column now spans a full row on narrow screens. Homepage footer text now matches the shared 13px mobile size.
- Preserve the concise example-based positioning. Detailed schemas and assignment requirements belong in project briefs and these internal notes.

## Remaining factual copy gaps in legal drafts

These are observations about the existing text, not replacement legal language. The legal pages were not changed in this pass.

- `privacy.html:59` describes an operating evaluation service whose judgments power a public benchmark. Lines 63 and 71 frame the waitlist around benchmark-result emails. Line 78 promises a fixed attribution rule for published and licensed data. Those statements do not match the broader proposed dataset projects and project-specific terms described elsewhere.
- `terms.html:62` describes a blind review protocol, benchmark leaderboards, a results waitlist, and an invitation-only evaluation platform. Lines 66 and 68 also center contributor participation on the benchmark. Line 72 describes public leaderboards and methodology that the current public site no longer presents.
- Privacy placeholders remain for the update date, contact details, and service-provider list (`privacy.html:54`, 59, 81, 84). Terms placeholders remain for the update date, legal entity, liability amount, jurisdiction, and contact (`terms.html:54`, 59, 78, 84).
- Both pages label themselves as drafts. Application and waitlist forms still link to those drafts as their terms and privacy policy. Final wording depends on the company's actual practices and details, which this UI pass does not establish.
