# ADR-0229: App Chrome as a Separate Configuration Layer

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 26.5 — App Chrome

## Context

Generated React applications need a shared chrome (header, side nav, breadcrumb, footer) that applies to every page. Two implementation strategies were considered: embed chrome in every generated page component, or extract chrome into a dedicated configuration layer.

## Decision

App Chrome is a separate configuration entity (`AppChromeConfig`) stored per generated project. The configuration declares which chrome block is assigned to each region and with what parameters. The generated app's root layout component reads this configuration at build time and renders the chrome around page content.

Pages do not contain chrome markup. Pages render their own content only.

## Consequences

- Changing the chrome configuration rebuilds the app without regenerating any page components
- Designers can edit the chrome from a single surface rather than editing N pages
- The Designer canvas renders chrome regions as locked overlays — editors can see context but cannot accidentally edit chrome from a page view
- A single AI proposal covers the whole app's chrome rather than repeating chrome decisions per page

## Alternatives considered

- **Chrome embedded per page** — duplicates markup; chrome changes require editing every page; AI would regenerate chrome on every page regeneration
- **Chrome as a Tailwind CSS utility class** — insufficient; chrome is structural JSX, not a style concern
