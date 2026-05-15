# StoryPlots — Supabase email templates

Dark-themed HTML templates for the 6 Supabase auth emails. Match the app's
brand tokens (`frontend/src/styles/tokens.css`): `#0F0F10` outer (`--sp-bg`),
`#1C1C1E` card (`--sp-bg-2`), `#57534E` borders (`--sp-border`), `#F2F1ED`
primary text, `#B0AAA0` secondary, `#928D82` footer, `#F5B547 → #FF7B3D`
amber-orange gradient on the CTA with `#000000` text on it
(`--sp-fg-on-brand`). Neutral near-black + warm grays — no violet tint.

## How to apply

1. Open Supabase dashboard → **Authentication → Emails → Templates**.
2. For each template below, click into its row, paste:
   - The **Subject** into the subject field.
   - The contents of the matching `.html` file into the **Message body** field.
3. Click **Save changes** at the bottom of each template.

## Mapping

| Supabase template | Subject | Body file |
|---|---|---|
| Confirm sign up | `Confirm your StoryPlots account` | `01-confirm-signup.html` |
| Magic link | `Your StoryPlots sign-in link` | `02-magic-link.html` |
| Reset password | `Reset your StoryPlots password` | `03-reset-password.html` |
| Change email address | `Confirm your new email` | `04-change-email.html` |
| Invite user | `You're invited to StoryPlots` | `05-invite-user.html` |
| Reauthentication | `Your StoryPlots verification code` | `06-reauthentication.html` |

## Logo image

All templates use the wordmark image hosted at
**`https://storyplots.app/logos/logo.png`** (672×200, white-on-transparent,
served by Vercel from `frontend/public/logos/logo.png`). Rendered at width
160 in the header so the height resolves to ~48px proportionally.

If the production domain changes (or you haven't pointed `storyplots.app` at
Vercel yet), find-and-replace the URL across the 6 files before pasting —
e.g. swap to `https://<project>.vercel.app/logos/logo.png` or to whatever the
deployed host serves.

The `alt="StoryPlots"` keeps the header readable in clients that block
remote images by default (Outlook 2016+, some corporate filters).

## Design notes

- **Outlook fallback**: the CTA button has a solid `bgcolor="#F5B547"` and an
  inline `linear-gradient`. Outlook (which can't render CSS gradients) falls
  back to the solid amber; Gmail/Apple Mail/iOS show the gradient.
- **Dark mode**: the colors are baked dark by design. The `color-scheme`
  meta tags tell modern clients not to invert the palette.
- **Font**: system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI",
  Helvetica, Arial`). No custom font (email clients strip them anyway).
- **Width**: 560px max, fluid below 480px via the inline `@media` block.
- **Plain link fallback**: every action email includes the raw URL below the
  button for clients that strip CTAs or for copy-paste users.
- **Reauthentication template** is different: it shows the 6-digit
  `{{ .Token }}` in a large monospace block instead of a CTA button (the
  user types the code into the app).

## Verifying

After saving each template, trigger the corresponding flow once with a real
inbox (Gmail + Outlook web at minimum) to confirm rendering. The built-in
Supabase mailer is rate-limited and meant for testing — for production you'll
want to configure a real SMTP provider in the **SMTP Settings** tab.
