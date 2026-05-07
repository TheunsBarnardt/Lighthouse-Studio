# ADR-0176: System Font Stacks Default, Google Fonts Opt-In

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 23 (Stage 3: Design Tokens)

## Context

Typography generation must choose font families. The options are:

1. **System font stacks** — use fonts already installed on the user's device (Inter on macOS, Segoe UI on Windows, etc.); no external requests; instant rendering; no privacy concerns
2. **Google Fonts** — free web fonts with excellent quality and selection; requires an external HTTP request to fonts.googleapis.com on page load; fonts are cached but send the user's IP to Google
3. **Self-hosted web fonts** — full control over loading; no privacy issues; but requires the customer to host font files and adds build complexity
4. **Auto-bundled web fonts** — the platform selects and bundles fonts automatically into the generated app

## Decision

**Default to system font stacks.** Google Fonts (and other web fonts) are available as explicit opt-in via the brand input form.

The typography prompt is seeded with a library of high-quality system font stacks:
- Sans-serif: `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
- Monospace: `'Cascadia Code', 'Fira Code', 'Consolas', 'Courier New', monospace`
- Display: `system-ui` by default (may be overridden)

If the user provides a preferred font family in brand inputs, the platform uses it — but warns about loading performance if it's a web font.

The platform does **not** auto-bundle web fonts without explicit user choice.

## Consequences

**Better:**
- Zero additional HTTP requests on page load for default deployments
- No GDPR/privacy issues with font loading (no third-party tracking)
- Faster first-contentful paint for default generated apps
- System fonts look native on each platform

**Worse:**
- System font appearance varies slightly across operating systems
- Customers expecting specific custom fonts must configure them explicitly
- The generated app may look "less distinctive" to users who expect a specific brand typeface

**Neutral:**
- When a customer opts in to Google Fonts, the platform generates the correct `<link>` tag in the app's HTML template; this is well-understood and not a new risk

## Alternatives Considered

- **Auto-select and bundle Google Fonts** — rejected; creates privacy and performance implications without customer consent
- **Always use Google Fonts** — rejected; many enterprise customers have policies against third-party font loading
- **Require customer to specify fonts** — rejected; system stacks are a sensible default; requiring a decision for every project adds friction without value
