# FE Integration: Password APIs

Canonical index: [FE_API_INDEX.md](FE_API_INDEX.md)

This document covers the password-related APIs currently active in the backend.

## Recommended Recovery Flow

Use the OTP email flow as the primary forgot-password experience:

1. `POST /auth/forgot-password/send-otp`
2. `POST /auth/forgot-password/verify-otp`
3. `POST /auth/forgot-password/reset-with-token`

Detailed contract: [FE_FORGOT_PASSWORD_OTP_APIS.md](FE_FORGOT_PASSWORD_OTP_APIS.md)

## Legacy Recovery Flow

The legacy phone-based reset endpoint still exists for backward compatibility:

### `POST /auth/forgot-password`

Request body:

```json
{
  "email": "user@example.com",
  "phoneNumber": "0909123456",
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

- `404` Account not found for this email address.
- `400` The account does not have a registered phone number.
- `401` Email address or phone number is incorrect.

## Change Password for Logged-in Users

### `POST /auth/change-password`

Auth:

```text
Authorization: Bearer <access_token>
```

Request body:

```json
{
  "oldPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

Success response:

```json
{
  "message": "Password changed successfully."
}
```

Typical errors:

- `401` token invalid or expired
- `401` current password is incorrect
- `404` account not found
- `400` the account does not use a local password

## FE Notes

- Validate password length on FE before calling any password API.
- Never log plaintext passwords, OTPs, or reset tokens.
- After password reset or change, redirect the user to login if your session policy requires it.
- The change-password endpoint does not revoke existing tokens automatically.
