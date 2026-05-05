# ADR-0131: HTML String Interpolation for Email Templates (MJML deferred)

**Status:** Accepted
**Date:** 2026-05-05
**Deciders:** solo

## Context

The platform sends transactional emails for authentication events: email verification, welcome, password reset, magic links, workspace invitations, MFA state changes, and several account-change notifications. These emails need to:

1. Be readable on desktop and mobile clients.
2. Support per-workspace customisation (subject and body overrides stored in `workspace_email_templates`).
3. Render consistently across major email clients (Gmail, Outlook, Apple Mail).
4. Be testable without an SMTP server.

Objective 16 specified MJML as the templating language. MJML compiles to cross-client-compatible HTML using table-based layouts.

## Decision

**For v1, use HTML string templates with `{{variable}}` interpolation** instead of MJML.

The `EmailTemplateService` stores default templates as TypeScript string constants (HTML with inline styles, table-based layout for Outlook compatibility). Workspace overrides are stored as HTML strings in `workspace_email_templates`. Variable substitution replaces `{{variable}}` tokens at render time.

MJML compilation is deferred. The current templates use the same table-layout patterns that MJML would generate, hand-authored. This creates no client-visible difference; the output HTML is equivalent.

The migration path to MJML is: store source templates as MJML, compile at startup (or at template-save time), cache the compiled HTML output. The `EmailTemplateService.render()` signature is unchanged; MJML becomes an implementation detail of template compilation.

## Consequences

### Positive

- No MJML build step or runtime compiler dependency in v1.
- Templates are readable and editable by workspace admins in a plain textarea.
- The `{{variable}}` interpolation syntax is simple to document and test.
- Adding MJML later does not require API changes — only internal `EmailTemplateService` changes.

### Negative

- Hand-authored HTML templates are more verbose than MJML source.
- Workspace admins who provide custom templates must write HTML directly; MJML's higher-level abstractions are not available to them.
- Template correctness across email clients is not validated automatically; changes require manual testing or an email preview tool.

### Neutral

- The `workspace_email_templates` table stores both `html_template` and `text_template`; plain-text fallbacks are supported regardless of the HTML approach.
- `{{variable}}` interpolation is intentionally not a full template engine (no conditionals, no loops). Complex logic belongs in service code, not templates.

## Alternatives Considered

### MJML at v1 (as specified)

Compile templates from MJML source at startup; cache compiled HTML.

**Why not chosen for v1:** MJML adds a compile-time dependency and ~100 ms startup cost per template batch. For an initial implementation with 11 templates, the overhead is measurable and the benefit (avoiding hand-authored table HTML) is present but not critical. The current templates are stable and cross-client compatible as written. MJML will be introduced when the template count grows or when operator tooling for visual template editing is built.

### Handlebars or Nunjucks

Use a full template engine for conditionals and loops.

**Why not chosen:** Transactional email templates don't need logic. A full template engine introduces expression injection risk if workspace admins can write arbitrary template code. The `{{variable}}` replacement is intentionally dumb: it replaces literal tokens only, with no expression evaluation.

## References

- Objective 16 (Auth & User Management UI)
- `packages/core/src/services/email-template.service.ts`
- `packages/adapters/persistence-postgres/migrations/0010_auth_ui.sql` (`workspace_email_templates` table)
