# Postman Quick Test: Delete Conversation

This guide is for FE/QA to validate the delete-chat behavior in under two minutes.

## Included Files

- `AI-Study-Buddy-Delete-Chat-Quick.postman_collection.json`
- `AI-Study-Buddy-Delete-Chat-Quick.local.postman_environment.json`

## Pre-Conditions

- Backend is running at `baseUrl` (default: `http://localhost:3001`).
- Test account in environment exists (`email`, `password`).
- The account has at least one conversation.

## Run Steps

1. Import collection and environment into Postman.
2. Select environment: `AI Study Buddy Delete Chat Quick Local`.
3. Run requests in order:
    1. `POST /auth/login`
    2. `GET /conversations` (auto-select first conversation)
    3. `DELETE /conversations/:conversationId`
    4. `GET /conversations` (verify removed)

## Expected Assertions

- Login stores JWT token to environment variable `token`.
- Delete returns status 200.
- Delete response message equals `Conversation deleted successfully.`.
- Final list no longer contains `deletedConversationId`.

## Troubleshooting

- 401 Unauthorized:
   - Token is missing/expired.
   - Re-run login and verify `token` variable is set.
- No conversation found at step 2:
   - Create a chat first, then rerun collection.
- 404 at delete step:
   - Conversation already deleted, or does not belong to current user.
