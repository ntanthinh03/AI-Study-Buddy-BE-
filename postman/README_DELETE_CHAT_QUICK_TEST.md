# Postman Quick Test for Delete Chat

## Files
- AI-Study-Buddy-Delete-Chat-Quick.postman_collection.json
- AI-Study-Buddy-Delete-Chat-Quick.local.postman_environment.json

## Import and Run
1. Open Postman.
2. Import both files above.
3. Select environment: AI Study Buddy Delete Chat Quick Local.
4. Ensure backend is running on baseUrl.
5. Run collection in this order:
   - 1) POST /auth/login
   - 2) GET /conversations (pick first id)
   - 3) DELETE /conversations/:conversationId
   - 4) GET /conversations (verify deleted)

## Required Data
- The user account from email/password must exist.
- The user should have at least one conversation before running step 2.

## Expected Result
- Step 3 returns status 200 with message Conversation deleted successfully.
- Step 4 confirms the deleted conversation id no longer exists in the conversation list.

## Common Failure Cases
- 401: token missing or expired.
- Step 2 fails with No conversation found: create one chat first, then rerun.
- 404 on step 3: conversation was already deleted or does not belong to current user.
