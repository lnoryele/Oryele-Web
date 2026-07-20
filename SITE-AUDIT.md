# Oryele Website Release Audit

## Release status
The source has been upgraded for a production-ready handoff and packaged as a runnable Astro project.

## Improvements applied
- Added a complete Platform dropdown instead of showing a misleading caret with no menu.
- Added active navigation states and `aria-current` indicators.
- Increased logo presence and tightened desktop navigation spacing.
- Improved dropdown animation, focus behavior, mobile overflow handling, and hamburger state animation.
- Added safer external-login link attributes.
- Removed invalid empty `@font-face` CSS.
- Removed unsupported website SearchAction structured data because the site has no search feature.
- Added path-aware breadcrumb structured data.
- Removed a redundant Google Fonts preload that could create duplicate requests.
- Added form-control font inheritance, selection styling, and a minimum viewport width.

## Validation completed
- Internal route inventory checked against `src/pages`.
- Navigation and footer destinations checked for corresponding routes.
- SEO metadata, canonical URLs, Open Graph metadata, robots directives, sitemap integration, and structured data reviewed.
- Responsive navigation, keyboard focus states, reduced-motion handling, semantic landmarks, and skip navigation reviewed.

## Important deployment note
A full Astro production build could not be executed in this environment because package installation did not complete within the available runtime. Run the commands below after extraction:

```bash
npm install
npm run dev
```

For a production check:

```bash
npm run build
npm run preview
```
