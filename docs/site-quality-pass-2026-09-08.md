# Site readability and functionality pass

## Work map

| Area | Owner | Purpose |
| --- | --- | --- |
| Homepage, typography, integration | Main agent | Keep the full-cover hero and floating header; improve reading size, contrast, spacing, signup behavior, and motion controls. |
| Community and research copy | Copy subagent | Explain gaming datasets clearly, keep examples concise, and describe planned projects accurately. |
| Expert application and waitlist | Forms subagent | Make validation, specialty ordering, submission feedback, and recovery from failures reliable. |
| Shared navigation | Navigation subagent | Support keyboard navigation, narrow screens, browser history, and reduced motion. |

## Result

- Home, community, and research use consistent reading widths, neutral surfaces, and clearer small text. The original floating header and full-cover video hero remain.
- All main menus expose Home, Datasets, Research, Community, and Benchmark. Footer dataset links are available across the main pages.
- The menu traps keyboard focus, closes with Escape, restores scrolling and focus, and prevents interaction with the background. Skip links and in-page navigation work with browser Back and Forward.
- Forms catch common mistakes before submitting, show field-level feedback, prevent duplicate submissions, preserve answers on errors, and time out stalled requests. Success requires explicit server confirmation. Pending requests protect the submitted answers from editing.
- Ranked specialties clear dependent choices correctly and restore after browser history navigation.
- The hero video has a play/pause control. Reduced-motion preferences, background tabs, offscreen visibility, menu opening, and the visitor's pause choice are respected.
- Visitors without JavaScript receive a usable email fallback for forms. The menu trigger is hidden while working header and footer links remain.
- Removed pages return a real 404 with a home link. The benchmark remains the requested minimal white progress page.

## Verification

- `npm test`: all 64 existing backend tests passed.
- Three reusable Chromium browser scripts are documented in the README. They cover homepage signup, expert forms, menu keyboard behavior, focus restoration, browser history, request failures/timeouts, and JavaScript-disabled fallbacks.
- Browser checks include widths of 320, 390, 768, and 1440 pixels, plus a 640 x 360 viewport for reflow at the effective width of 200% zoom on a 1280 x 720 window.
- Main landmarks, H1s, duplicate IDs, field labels, and same-page fragments were checked across nine public/error pages.
- Desktop and mobile screenshots were inspected. Internal assets/links and removed-blog 404 responses were checked locally.
- A separate manual local demo check submitted a test application, verified its presence in the admin review queue, and completed a waitlist signup against the in-memory database. No external database or email delivery was used.
- Reusable browser regressions mock or block write requests. They do not submit real applicant data.

## Current limits

The preview runs in demo mode with an in-memory database. Production Supabase configuration, delivery of project-update emails, and deployed behavior are outside these local checks. Browser checks used Chromium; Safari and Firefox were not installed in this environment.

The linked privacy and terms pages are still explicitly marked drafts and contain company placeholders and outdated benchmark-oriented descriptions. The concrete gaps are recorded in `copy-readability-notes-2026-09-08.md`; company details and actual data practices are needed to finalize them.
