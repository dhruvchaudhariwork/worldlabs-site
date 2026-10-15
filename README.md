# World Labs

Single-page website for [tryworldlabs.com](https://tryworldlabs.com).

The homepage contains the World Labs introduction, email contact, and two expandable sections: **Interact Bench** and **Worldline Bench**. Both start collapsed with a + toggle. Full Interact Bench results and metric definitions are inside its expanded section.

## Files

- `index.html`: the only page.
- `horizon.css`, `benchmark.css`: layout, typography, and benchmark styles.
- `scripts/benchmark-ui.js`: optional leaderboard suite switching.
- `assets/` and root icons: brand mark, local fonts, and their licenses.
- `data/opengameeval.json`: pinned benchmark scores and source provenance.
- `scripts/render-benchmark.js`: regenerates the Interact Bench section from the snapshot.
- `scripts/dev-server.js`: local static server.
- `vercel.json`: production URL settings.

## Development

Use Node.js 22 or later. No dependencies or build step are required.

```bash
npm run dev
```

Open `http://localhost:3000`. Set `PORT` to use another port.

After updating the verified benchmark snapshot, regenerate the homepage section:

```bash
npm run render:benchmark
```

Review the generated HTML and source metadata before committing. Benchmark content remains readable without JavaScript.

## Production

Pushes to `master` in [dhruvchaudhariwork/worldlabs-site](https://github.com/dhruvchaudhariwork/worldlabs-site) automatically deploy to [tryworldlabs.com](https://tryworldlabs.com) through Vercel.
