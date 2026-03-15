# PrimeLiving Supabase Email Templates

Use these files in Supabase Dashboard > Authentication > Email Templates.

## 1) Reset Password
- File: `backend/docs/PASSWORD_RESET_TEMPLATE.html`
- Supabase template: **Reset Password**
- CTA variable: `{{ .ConfirmationURL }}`

## 2) Email Verification
- File: `backend/docs/EMAIL_VERIFICATION_TEMPLATE.html`
- Supabase template: **Confirm signup**
- CTA variable: `{{ .ConfirmationURL }}`

## 3) Account Activation (Invites)
- File: `backend/docs/ACCOUNT_ACTIVATION_TEMPLATE.html`
- Supabase template: **Invite user**
- CTA variables: `{{ .RedirectTo }}`, `{{ .TokenHash }}`, `{{ .Data.name }}`, `{{ .Data.login_email }}`
- Important: Keep the link format as `/invite/confirm?token_hash=...&type=invite` to match frontend invite confirmation route.

## Backward-Compatible Existing File
- Existing invite template also kept at `backend/docs/OWNER_INVITE_TEMPLATE.html`.
