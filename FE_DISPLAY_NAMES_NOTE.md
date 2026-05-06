# FE Note: Quiz and Lesson Display Names

Canonical index: [FE_API_INDEX.md](FE_API_INDEX.md)

Use these fields for UI labels:

- Quiz group/course label: `quizName`
- Specific quiz title: `quizTitle`
- Lesson: `courseName`

FE can send `quizName` and `courseName` from AI summary flows; backend persists them directly.
FE can also send `quizTitle` for a more specific quiz label.

Quiz list/detail responses also return:

- `quizId`
- `quizName`
- `quizTitle`

Lesson list/detail responses also return:

- `courseName`
- `lessonTitle`

The UI should use `lessonTitle` instead of the legacy `title` field.

Fallbacks:

- Quiz without `quizName` falls back to `Quiz - <document name>`.
- Quiz without `quizTitle` falls back to `<document name> Quiz`.
- Lesson without `courseName` falls back to conversation title.
