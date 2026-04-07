# FE Integration Note - Upload PDF with Auth (AI Study Buddy)

## Context
Backend endpoint for user-owned document upload is protected by JWT.

- Endpoint: POST /documents/upload
- Content-Type: multipart/form-data
- File field name: file
- Auth: REQUIRED

## Mandatory Requirements

1) Always send Authorization header when uploading PDF:

Authorization: Bearer <access_token>

2) Ensure mobile app calls the correct backend port that is currently running.

- Backend may fallback from 3001 up to 3020 if a port is occupied.
- App must not hardcode one port only; it should read the active port from the backend startup log or use a configurable baseUrl.

## What FE must implement

### A. Login and token persistence

- Call POST /auth/login
- Save access_token securely (EncryptedSharedPreferences / secure storage)
- Attach token to all protected APIs, including /documents/upload

### B. Upload API contract

Request:
- Method: POST
- URL: {baseUrl}/documents/upload
- Headers:
  - Authorization: Bearer <token>
- Body (multipart/form-data):
  - file: <pdf_file>

Expected success:
- HTTP 201/200 with document object (id, fileName, fileSize, status, createdAt)

Common failure:
- HTTP 401 Unauthorized -> token missing, expired, invalid, or wrong backend target

### C. Base URL / Port strategy

- Preferred default: http://<backend-ip>:3001
- If connection fails, verify the actual backend startup log and update baseUrl to the active port.
- During development, support configurable baseUrl in app settings.

## Quick FE Checklist

- [ ] Token is attached for /documents/upload
- [ ] Header format is exactly: Bearer <token>
- [ ] Multipart field key is exactly: file
- [ ] App points to correct backend host and active port
- [ ] On 401, app triggers re-login flow and retries once with fresh token

## Suggested prompt to FE AI

Implement protected PDF upload for AI Study Buddy.

Use POST /documents/upload with multipart/form-data and field name "file".
Always attach Authorization: Bearer <access_token>.
The backend port is configurable and may fall back from 3001 up to 3020, so the app must use the active baseUrl from config or backend startup log.

Handle 401 Unauthorized by clearing the token and asking the user to log in again.
Show clear error messages for missing token, expired token, wrong baseUrl/port, unsupported file type, and network failure.
