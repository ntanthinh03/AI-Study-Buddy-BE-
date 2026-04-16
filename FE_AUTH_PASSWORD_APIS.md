# FE Integration: Password APIs

Canonical endpoint index: [FE_API_INDEX.md](FE_API_INDEX.md)

This document covers two password flows:

1. Forgot password with email + phone verification
2. Change password for authenticated users

## 1) Forgot Password

Endpoint: `POST /auth/forgot-password`

### Auth

No Bearer token required.

### Request Body

```json
{
  "email": "user@example.com",
  "phoneNumber": "0909123456",
  "newPassword": "newPassword123"
}
```

### Success Response

```json
{
  "message": "Password reset completed successfully."
}
```

### Error Cases

- 404: account not found by email
- 400: account exists but has no registered phone number
- 401: email and phone combination is invalid

## 2) Change Password

Endpoint: `POST /auth/change-password`

### Auth

Bearer token required.

Header:

```text
Authorization: Bearer <access_token>
```

### Request Body

```json
{
  "oldPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

### Success Response

```json
{
  "message": "Password changed successfully."
}
```

### Error Cases

- 401: token invalid/expired
- 401: old password is incorrect
- 404: account not found
- 400: account has no local password

## FE Implementation Notes

- Validate password length on FE before calling API.
- Never log plaintext passwords.
- If API returns 401 due to token expiration, clear session and redirect to login.
- Password change does not revoke existing token automatically; FE can choose either:
  - keep current session, or
  - force re-login by policy.

## Data Persistence Notes

- `users.password` is updated on success.
- `password_resets` stores forgot-password attempt history.
