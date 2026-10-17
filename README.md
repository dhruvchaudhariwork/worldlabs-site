# World Labs

Website for [tryworldlabs.com](https://tryworldlabs.com).

The homepage introduces World Labs as a research lab developing original training data, game-engine RL gyms, and controlled evaluation of agent progress. It includes email contact, game-developer partnerships, and a research thesis link. The retired Interact and Worldline Bench sections are no longer displayed.

## Files

- `index.html`: homepage.
- `memo.html`, `memo.css`: a detailed research memo at `/memo` covering game-engine RL, connected creative workflows, verification, existing-game partnerships, a proposed hosting model, broader simulation applications, and controlled experiments. It cites eight research papers and four primary technical references. The memo uses the homepage’s shared typography, colors, and column width, with responsive and print layouts.
- `horizon.css`: shared homepage and memo layout, typography, and brand styling.
- `assets/memo-figures/`: original workflow and training-loop diagrams, two source-derived research charts, mobile SVG compositions, downloadable PNGs, and the chart data in `research-data.csv`.
- `scripts/render-memo-figures.py`: optional Matplotlib authoring script for the figures; the site serves the committed assets and needs no Python runtime or build step.
- `assets/` and root icons: brand mark, local fonts, and their licenses.
- `scripts/dev-server.js`: local static server.
- `vercel.json`: production URL settings, including redirects from the retired `/benchmark` and `/benchmark.html` URLs to the homepage.

## Development

Use Node.js 22 or later. No dependencies or build step are required.

```bash
npm run dev
```

Open `http://localhost:3000`. Set `PORT` to use another port.

## Production

Pushes to `master` in [dhruvchaudhariwork/worldlabs-site](https://github.com/dhruvchaudhariwork/worldlabs-site) automatically deploy to [tryworldlabs.com](https://tryworldlabs.com) through Vercel.

## Illustration assets

The current memo contains three figures in the shared homepage style:

1. An original cross-tool workflow showing asset authoring, engine integration, runtime verification, and shared task state.
2. An original proposed execution/training architecture with protected verification, episode records, and model updates owned by the AI lab.
3. Two independently redrawn research charts. Panel A uses GPT-5.4/Codex rows from [GameDevBench v2, Table 2](https://arxiv.org/html/2602.11103v2#S4.T2.fig1): 41.1% versus 52.0% pass@1 without/with screenshot and video feedback. This is an inference comparison with different inference costs, not an RL training result. Panel B uses [Play to Generalize v4, Table 2](https://arxiv.org/html/2506.08011v4#S2.T2): Qwen2.5-VL-7B versus ViGaL Snake + Rotation on MathVista (68.0 → 71.9), MathVerse (49.0 → 52.4), and MathVision (26.0 → 27.5). Error bars are the reported after-RL standard deviations over three runs (0.4, 0.2, 0.3 percentage points). Baseline variability is not reported. Both charts use full 0–100% axes and describe separate experiments, not a common leaderboard.

The diagrams describe proposals, not an implemented product. The charts visualize published numerical results, not World Labs measurements; no original paper artwork is reproduced. Source versions, exact values, and uncertainty are recorded in the downloadable CSV. The authoring script embeds the local Geist glyphs as SVG paths and writes a separate mobile layout for each asset, keeping labels sharp and independent of external fonts. To regenerate, use the optional command documented at the top of the script.

The retained illustration from the earlier memo is a conceptual image generated with the built-in image-generation tool, not a screenshot of an implemented environment. It is saved as `assets/memo-environment.jpg` (1600 × 800) and `assets/memo-environment-800.jpg` (800 × 400). The current memo uses a text-based illustrative task; the earlier illustration is retained as an unused source asset. The local EB Garamond and Geist fonts are losslessly compressed to WOFF2; glyph coverage and advance metrics are preserved, with the original licenses alongside them.

<details>
<summary>Cover generation prompt</summary>

Use case: stylized-concept. Asset type: wide editorial cover illustration for a World Labs research memo about AI agents completing work across game engines and creative tools. Create a refined architectural-scale model of a small playable 3D test environment: two pale concrete platforms joined by a narrow walkable bridge, with a simple rectangular sliding gate and its frame at the far end. The gate is the single focal object, in a muted desaturated green-gray. One small white cylindrical player proxy on the bridge suggests gameplay testing. A separated wireframe study of the same rectangular gate stands unobtrusively beside the model, suggesting an asset moving from creation to integration. Precise orthographic three-quarter view, elegant technical monograph rendering, off-white matte background, very soft natural shadows, subtle surface texture. Wide 2:1 composition with generous breathing room, scene centered and readable at small size. Restrained grayscale with only the green-gray gate as accent. No text, numbers, labels, logos, interface panels, browser chrome, arrows, gradients, glow, scenery, robots, or decorative objects. This is a conceptual editorial illustration, not a product screenshot.

</details>
