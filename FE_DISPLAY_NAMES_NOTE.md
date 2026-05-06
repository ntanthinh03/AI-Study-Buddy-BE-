# FE Note: Quiz and Lesson Display Names

Canonical index: [FE_API_INDEX.md](FE_API_INDEX.md)

Use these fields for UI labels:

- Quiz: `quizName`
- Lesson: `courseName`

FE can send `quizName` and `courseName` from AI summary flows; backend persists them directly.

Fallbacks:

- Quiz without `quizName` falls back to `Quiz - <document name>`.
- Lesson without `courseName` falls back to conversation title.
