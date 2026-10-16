# World Labs

Website for [tryworldlabs.com](https://tryworldlabs.com).

The homepage introduces World Labs as a research lab developing original training data, game-engine RL gyms, and controlled evaluation of agent progress. It includes email contact, a research thesis link, and an expandable **Worldline Bench** section that starts collapsed with a + toggle.

## Files

- `index.html`: homepage.
- `memo.html`, `memo.css`: the research thesis at `/memo`, with two concise technical diagrams covering gym execution and controlled training comparisons. CSS signal animations respect reduced-motion preferences; diagrams remain readable without motion and in print.
- `horizon.css`, `benchmark.css`: layout, typography, and Worldline Bench styles.
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

The retained illustration from the earlier memo is a conceptual image generated with the built-in image-generation tool, not a screenshot of an implemented environment. It is saved as `assets/memo-environment.jpg` (1600 × 800) and `assets/memo-environment-800.jpg` (800 × 400). The current memo uses native SVG diagrams. The local EB Garamond and Geist fonts are losslessly compressed to WOFF2; glyph coverage and advance metrics are preserved, with the original licenses alongside them.

<details>
<summary>Cover generation prompt</summary>

Use case: stylized-concept. Asset type: wide editorial cover illustration for a World Labs research memo about AI agents completing work across game engines and creative tools. Create a refined architectural-scale model of a small playable 3D test environment: two pale concrete platforms joined by a narrow walkable bridge, with a simple rectangular sliding gate and its frame at the far end. The gate is the single focal object, in a muted desaturated green-gray. One small white cylindrical player proxy on the bridge suggests gameplay testing. A separated wireframe study of the same rectangular gate stands unobtrusively beside the model, suggesting an asset moving from creation to integration. Precise orthographic three-quarter view, elegant technical monograph rendering, off-white matte background, very soft natural shadows, subtle surface texture. Wide 2:1 composition with generous breathing room, scene centered and readable at small size. Restrained grayscale with only the green-gray gate as accent. No text, numbers, labels, logos, interface panels, browser chrome, arrows, gradients, glow, scenery, robots, or decorative objects. This is a conceptual editorial illustration, not a product screenshot.

</details>
