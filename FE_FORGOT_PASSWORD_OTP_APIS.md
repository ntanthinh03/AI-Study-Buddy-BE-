# FE Guide: Forgot Password by Email OTP

Use this flow for the password recovery screen.

## Flow Summary

1. FE requests OTP by email.
2. User receives a 6-digit OTP by email.
3. FE verifies OTP with the same email.
4. FE calls reset-password with email + newPassword.

## Recommended UI States

- Step 1: request OTP
- Step 2: verify OTP
- Step 3: set new password
- Final: redirect to login

## 1) Send OTP

Endpoint: `POST /auth/forgot-password/send-otp`

Request body:

```json
{
  "email": "user@example.com"
}
```

Success response:

```json
{
  "message": "If the account exists, an OTP has been sent to the email address.",
  "expiresInMinutes": 10
}
```

Typical errors:

- `400` Email address is required.
- `400` Email address is invalid.
- `404` Account not found for this email address.
- `503` Brevo mailer is not configured or unavailable.

## 2) Verify OTP

Endpoint: `POST /auth/forgot-password/verify-otp`

Request body:

```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

Validation rules:

- `otp` must be exactly 6 digits.

Success response:

```json
{
  "message": "OTP verified successfully."
}
```

Typical errors:

- `400` OTP is invalid or has expired.
- `400` Too many invalid OTP attempts. Please request a new OTP.

## 3) Reset Password

Endpoint: `POST /auth/forgot-password/reset-password`

Request body:

```json
{
  "email": "user@example.com",
  "newPassword": "newPassword123"
}
```

Success response:

```json
{
  "message": "Password reset completed successfully."
}
```

Typical errors:

- `400` Password must be at least 6 characters long.
- `400` OTP is invalid or has expired (OTP not verified, expired, or already consumed).

## FE Implementation Notes

- Keep `email` in local state between step 1 and step 2.
- Do not allow OTP verification until the input has 6 digits.
- After OTP verification succeeds, call reset-password with `email` and `newPassword`.
- Do not display or log the OTP.
- After password reset succeeds, redirect user to login and clear recovery state.
- If you are testing locally without Brevo, set `MAILER_DEV_FALLBACK=true` only in development.
