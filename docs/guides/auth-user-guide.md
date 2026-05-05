# Authentication & Account Management Guide

This guide covers everything end-users and workspace administrators need to know about authentication and account management in Lighthouse Studio.

---

## Signing in

Navigate to `/auth/sign-in`. Enter your email address and password, then click **Sign in**.

**Remember me** — select this checkbox to extend your session to 30 days (default sessions expire after 24 hours of inactivity).

If your workspace uses a single sign-on provider (Google, Microsoft Entra, GitHub, or a custom SAML/OIDC IdP), click the corresponding button instead of entering a password.

### Magic link

Click **Sign in with magic link**, enter your email, and check your inbox. Click the link in the email to sign in without a password. Magic links are one-time use and expire after 15 minutes.

### MFA challenge

If you have multi-factor authentication enabled, you will be prompted for a 6-digit code after entering your password. Open your authenticator app and enter the current code.

If you have lost access to your authenticator app, click **Use recovery code instead** and enter one of the recovery codes you saved during MFA setup.

---

## Creating an account

Navigate to `/auth/sign-up`. Enter your name, email address, and a password (minimum 8 characters). Click **Create account**.

You will receive a verification email. Click the link in the email to verify your address before you can sign in.

If you received an invitation from a workspace administrator, click the link in the invitation email instead — this starts a specialised sign-up flow that automatically joins you to the workspace.

---

## Account settings

All account settings are at `/account/*`.

### Profile (`/account/profile`)

Update your display name and upload a profile photo. Supported formats: JPEG, PNG, WebP, GIF (max 5 MB).

### Password (`/account/password`)

Change your password by entering your current password and a new password twice. If you have forgotten your current password, use the **I forgot my password** link.

### Email address (`/account/email`)

Enter a new email address and click **Send verification**. A verification link is sent to the new address. Your email does not change until you click the link. Your old address remains active until the change is confirmed.

### Multi-factor authentication (`/account/mfa`)

Enable MFA to require a time-based code from your authenticator app in addition to your password:

1. Click **Enable MFA**.
2. Scan the QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.).
3. Enter the 6-digit code displayed by the app to confirm.
4. Copy or download your 10 recovery codes. Store them somewhere safe — you will only see them once.
5. Check **I have saved my recovery codes** and click **Activate MFA**.

To disable MFA, click **Disable MFA** and confirm by entering your current password.

### Active sessions (`/account/sessions`)

View all devices where you are currently signed in. Each session shows the browser, operating system, IP address, and when it was last active. Your current session is marked **This device**.

- **Revoke** — sign out from that device.
- **Sign out everywhere else** — revoke all sessions except the one you are currently using.

### Linked identities (`/account/identities`)

Link additional sign-in methods to your account (e.g., link your Google account so you can sign in with either email/password or Google). Click **Link account** and follow the provider's login flow.

To unlink an identity, click **Unlink** next to it. You must always have at least one active identity.

### Danger zone (`/account/danger-zone`)

- **Export my data** — download a copy of your account data (profile, workspaces, activity).
- **Delete my account** — permanently delete your account. Enter your email address to confirm. This action is irreversible and removes you from all workspaces.

---

## Workspace member management

Workspace administrators manage members at `/workspaces/<slug>/members`.

### Inviting members

Click **Invite member**, enter the invitee's email address, and click **Send invitation**. An email is sent with a one-time link valid for 7 days. Pending invitations appear on the **Invitations** tab and can be revoked before they are accepted.

### Changing roles

Open a member's detail page by clicking their name. On the **Roles** tab, add or remove roles.

### Removing members

On the member detail page, click **Remove from workspace** (bottom of the page). The member retains their account but loses access to this workspace immediately.

---

## Password reset

If you have forgotten your password:

1. On the sign-in page, click **Forgot password?**.
2. Enter your email address and click **Send reset link**.
3. Check your email for a reset link (valid for 1 hour).
4. Click the link and enter a new password.

For security, the page does not confirm whether the email address is registered. If you don't receive the email, check your spam folder or contact your workspace administrator.

---

## Frequently asked questions

**I accepted an invitation but I'm not showing up in the member list.**  
Try refreshing the members page. If the issue persists, ask your workspace administrator to check the pending invitations list and resend the invitation.

**My MFA code isn't working.**  
Ensure your device's clock is accurate (TOTP codes are time-sensitive). If the code is consistently rejected, try your next code 30 seconds later. If you are locked out, contact your workspace administrator to reset your MFA.

**I received a "Sign in from a new device" email but didn't sign in recently.**  
This may indicate unauthorised access. Go to `/account/sessions` immediately and revoke all sessions. Then change your password and enable MFA if you haven't already. Contact your workspace administrator.

---

## Screen reader walkthrough

The platform's auth screens are tested against NVDA (Windows) and VoiceOver (macOS/iOS). Every interactive element has a visible label and an accessible name; error messages are announced via `aria-live` regions.

### Sign-in with NVDA (Windows)

1. Open Chrome or Firefox and navigate to `/auth/sign-in`.
2. NVDA reads the page heading: _"Sign in to your account"_.
3. Tab to the **Email address** field — NVDA announces _"Email address, edit text"_.
4. Type your email and Tab to **Password** — announced _"Password, edit text"_.
5. Tab to **Remember me** — announced _"Remember me for 30 days, checkbox, not checked"_.
6. Tab to **Sign in** and press Enter.
7. If authentication fails, NVDA immediately reads the error region: _"Invalid email or password."_
8. On success, NVDA reads the new page heading of the workspace you are taken to.

### Sign-in with VoiceOver (macOS)

1. Open Safari and navigate to `/auth/sign-in`.
2. Press VO+F8 to open the Web Rotor; select **Form Controls** to list all fields.
3. Navigate to **Email address** (VO+Right) — VoiceOver reads _"Email address, required, edit text"_.
4. Fill in email, navigate to **Password** — announced _"Password, required, secure text field"_.
5. Navigate to **Sign in** button and press VO+Space.
6. On error, VoiceOver announces the live region: _"Invalid email or password."_

### MFA challenge with screen reader

After password entry, if MFA is enrolled:

1. Focus moves to the MFA challenge page heading: _"Enter your verification code"_.
2. Tab to the code input — announced _"Verification code, edit text"_.
3. Enter the 6-digit code. The field accepts numeric input only.
4. To use a recovery code instead, Tab to **Use recovery code instead** and press Enter; the input format changes and VoiceOver/NVDA announces the new label.

### Known limitations

- The CAPTCHA widget (sign-up and password-reset only) is provided by a third-party service (hCaptcha or Cloudflare Turnstile). Both providers offer an audio challenge accessible via keyboard. Tab to the CAPTCHA widget and press Space; an audio button becomes available.
- The avatar crop control (account profile) uses a `<canvas>` element. Keyboard-only cropping is supported but not yet optimised for screen readers; this is tracked for improvement.
