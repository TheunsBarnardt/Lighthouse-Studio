# Runbook: Auth UI Customisation (Branding)

**Applies to:** Workspace administrators  
**Last updated:** 2026-05-05

## Overview

Workspace administrators can customise the visual appearance of auth screens and outbound emails through the Branding settings page at `/workspaces/<slug>/branding`.

## Configurable properties

| Property             | What it changes                                                      |
| -------------------- | -------------------------------------------------------------------- |
| Company name         | Heading text in auth screens and email bodies                        |
| Primary colour       | Main button/link colour (injected as `--color-primary` CSS variable) |
| Email from name      | "From" name in all outbound emails for this workspace                |
| Logo                 | Image shown in the auth layout header                                |
| Custom CSS variables | Fine-grained colour overrides beyond primary colour                  |

## Setting the primary colour

1. Navigate to `/workspaces/<slug>/branding`.
2. Click the colour swatch or type a hex value (e.g., `#3b82f6`) in the **Primary colour** field.
3. Click **Save branding**.
4. Sign out and back in to see the updated colour on the auth screens.

## Uploading a logo

Logos are stored in the workspace's storage bucket.

1. Go to the Storage Browser at `/workspaces/<slug>/storage`.
2. Upload the logo image (JPEG, PNG, WebP, SVG). Note the file ID from the file detail panel.
3. Return to `/workspaces/<slug>/branding`.
4. In the API (direct call or via the admin SDK):
   ```
   PUT /api/v1/workspaces/<slug>/branding
   { "logoFileId": "<file-id>" }
   ```
   (A UI file picker for logo upload is planned for a future release.)

## Custom CSS variables

The **Custom CSS variables** textarea accepts CSS variable declarations only. Example:

```css
--color-primary: #6366f1;
--color-primary-foreground: #ffffff;
--color-accent: #f59e0b;
--radius: 0.375rem;
```

Lines that are not CSS variable declarations are silently stripped. Attempting to inject other CSS (selectors, `url()`, media queries) has no effect.

## Resetting branding

To restore all branding settings to installation defaults, use the API:

```
DELETE /api/v1/workspaces/<slug>/branding
```

This removes the `workspace_branding` row and the next page load will use the installation defaults.

## Troubleshooting

### Changes don't appear after saving

The Next.js layout fetches branding per request, so a hard refresh (Ctrl+Shift+R) should show the update. If not, verify the `PUT` response returned 200 and check the database for the updated row.

### Custom CSS is stripped

Verify each line follows the form `--variable-name: value;`. Check the allowlisted variable names in `packages/core/src/services/branding.service.ts`. Only whitelisted names are retained.

### Email from name not updating

The email from name is applied at send time by the email dispatch layer. Emails sent before the change are unaffected. Verify SMTP is configured and test with a new invitation.
