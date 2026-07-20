# Start Oryele on macOS

Use a new folder. Do not extract this release over an older Oryele folder.

```bash
cd ~/Downloads/oryele-site-v18.2
rm -rf node_modules .astro dist
npm ci
npm run dev:clean
```

Open the exact Local URL shown by Astro.

If an older Astro server is still running, stop it first with Control-C in its Terminal window.
