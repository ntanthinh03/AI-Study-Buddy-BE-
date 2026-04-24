export const AUTH_MESSAGES = {
  EMAIL_IN_USE: 'Email address is already in use.',
  PHONE_REQUIRED: 'Phone number is required.',
  EMAIL_NOT_FOUND: 'Email address not found.',
  PASSWORD_INCORRECT: 'Password is incorrect.',
  ACCOUNT_NOT_FOUND_FOR_EMAIL: 'Account not found for this email address.',
  REGISTERED_PHONE_REQUIRED:
    'The account does not have a registered phone number.',
  EMAIL_OR_PHONE_INCORRECT: 'Email address or phone number is incorrect.',
  AUTHENTICATION_REQUIRED: 'Authentication is required.',
  NO_ACCOUNT_FOUND: 'No account was found.',
  LOCAL_PASSWORD_REQUIRED: 'The account does not use a local password.',
  CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect.',
  PASSWORD_RESET_COMPLETED: 'Password reset completed successfully.',
  PASSWORD_CHANGED: 'Password changed successfully.',
  OTP_SENT_IF_ACCOUNT_EXISTS:
    'If the account exists, an OTP has been sent to the email address.',
  OTP_INVALID_OR_EXPIRED: 'OTP is invalid or has expired.',
  OTP_TOO_MANY_ATTEMPTS:
    'Too many invalid OTP attempts. Please request a new OTP.',
  OTP_VERIFIED: 'OTP verified successfully.',
  RESET_TOKEN_INVALID_OR_EXPIRED: 'Reset token is invalid or has expired.',
  RESET_TOKEN_ALREADY_USED: 'Reset token has already been used.',
} as const;

export const AUTH_VALIDATION_MESSAGES = {
  EMAIL_REQUIRED: 'Email address is required.',
  EMAIL_INVALID: 'Email address is invalid.',
  PASSWORD_MIN_LENGTH: 'Password must be at least 6 characters long.',
  FULL_NAME_REQUIRED: 'Full name is required.',
  PHONE_REQUIRED: 'Phone number is required.',
  OTP_MUST_BE_6_DIGITS: 'OTP must be exactly 6 digits.',
  RESET_TOKEN_REQUIRED: 'Reset token is required.',
} as const;

export const CHAT_MESSAGES = {
  MESSAGE_REQUIRED: 'Message is required.',
  IMAGE_REQUIRED: 'Image is required.',
  ONLY_IMAGE_FILES_SUPPORTED: 'Only image files are supported.',
  QUESTION_REQUIRED: 'Question is required.',
  AI_CHAT_FAILED: 'AI chat failed.',
  FALLBACK_RECOVERED: 'CHAT | fallback recovered: ',
  MODEL_RETURNED_EMPTY_RESPONSE: 'The model returned an empty response.',
} as const;

export const AI_MESSAGES = {
  SUMMARY_FAILED: 'AI summary failed: ',
  CHAT_FAILED: 'AI chat failed: local model unavailable.',
  IMAGE_ANALYSIS_FAILED: 'AI image analysis failed: ',
  QUIZ_GENERATION_FAILED: 'AI quiz generation failed: ',
  GENERATION_FAILED: 'AI generation failed.',
  NO_JSON_ARRAY: 'AI response does not contain a JSON array.',
  QUIZ_OUTPUT_NOT_ARRAY: 'Quiz output is not a valid array.',
  MODEL_RETURNED_EMPTY_CONTENT: 'The model returned an empty response.',
} as const;

export const DOCUMENT_MESSAGES = {
  DOCUMENT_NOT_READY_FOR_CHAT:
    'The document is not ready for chat. Please wait until processing is complete.',
  ARTIFACT_REQUIRED: 'artifactType and artifact are required.',
  IMAGE_NOT_FOUND: 'Image not found for this message.',
  CONVERSATION_NOT_FOUND: 'Conversation not found.',
  CONVERSATION_DELETED: 'Conversation deleted successfully.',
  DOCUMENT_NOT_READY_FOR_STUDY_PLAN:
    'The document is not ready for a study plan.',
  DOCUMENT_NOT_FOUND: 'Document not found.',
  DOCUMENT_DELETED: 'Document and related data were deleted successfully.',
  PDF_NO_EXTRACTABLE_TEXT: 'PDF does not contain extractable text.',
} as const;

export const PROGRESS_MESSAGES = {
  NEXT_MODULE_UNLOCKED:
    'Current module completed. The next module has been unlocked.',
  MODULE_UPDATED: 'Module updated successfully.',
  CONVERSATION_NOT_FOUND: 'Conversation not found.',
  LESSON_NOT_FOUND: 'Lesson not found.',
  LESSON_QUIZ_SAVED: 'Lesson quiz was saved successfully.',
  LESSON_STATUS_UPDATED: 'Lesson status was updated successfully.',
} as const;

export const RAG_MESSAGES = {
  NO_FILE_UPLOADED: 'No file was uploaded.',
  ONLY_IMAGE_FILES_SUPPORTED_FOR_UPLOAD_IMAGE:
    'Only image files are supported for /rag/upload-image.',
  QUESTION_REQUIRED: 'Question is required.',
  AI_PROCESSING_FAILED: 'AI processing failed.',
  TEXT_INGESTION_FAILED: 'Text ingestion failed.',
  PDF_INGESTION_FAILED: 'PDF ingestion failed.',
  IMAGE_INGESTION_FAILED: 'Image ingestion failed.',
  INPUT_TEXT_EMPTY: 'Input text is empty.',
  UPLOADED_PDF_BUFFER_EMPTY: 'Uploaded PDF buffer is empty.',
  NO_EXTRACTABLE_TEXT_IN_PDF: 'No extractable text was found in the PDF.',
  INVALID_IMAGE_MIME_TYPE: 'Invalid image MIME type.',
  UPLOADED_IMAGE_BUFFER_EMPTY: 'Uploaded image buffer is empty.',
  NO_EXTRACTABLE_TEXT_IN_IMAGE: 'No extractable text was found in the image.',
  PGVECTOR_UNAVAILABLE: 'RAG | pgvector unavailable; using memory store',
} as const;

export const QUIZ_MESSAGES = {
  DOCUMENT_NOT_FOUND: 'Document not found.',
  DOCUMENT_STILL_PROCESSING: 'The document is still being processed.',
  DOCUMENT_NO_EXTRACTABLE_TEXT:
    'The document does not contain extractable text.',
} as const;

export const BOOT_MESSAGES = {
  PORT_PREFERENCE: (preferredPort: number) =>
    `BOOT | preferred port ${preferredPort}`,
  FALLBACK_PORT_IN_USE: (preferredPort: number, candidatePort: number) =>
    `BOOT | fallback port ${candidatePort} in use instead of ${preferredPort}`,
  PORTS_UNAVAILABLE: (preferredPort: number, lastPort: number) =>
    `BOOT | ports ${preferredPort}-${lastPort} unavailable`,
  ACTIVE_PORT: (activePort: number) => `BOOT | active port ${activePort}`,
  READY: (activePort: number) => `BOOT | ready http://localhost:${activePort}`,
  OLLAMA: (baseUrl: string) => `BOOT | ollama ${baseUrl}`,
  QUANTIZATION: (profile: string) => `BOOT | quantization ${profile}`,
  TEXT_MODEL: (model: string) => `BOOT | text model ${model}`,
  VISION_MODEL: (model: string) => `BOOT | vision model ${model}`,
} as const;
