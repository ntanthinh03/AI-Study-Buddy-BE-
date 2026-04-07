# Changelog Bao Cao Du An / Project Changelog - AI Study Buddy

**Ngay cap nhat / Last updated:** 2026-04-07  
**Commit tham chieu / Reference commit:** `8b59463`  
**Pham vi / Scope:** Backend API, RAG/LLM integration, observability, test collections, documentation

## 1. Changelog Tong Hop / Summary Changelog

Trong dot cap nhat nay, he thong backend AI Study Buddy da duoc chuan hoa va hoan thien de phuc vu frontend, kiem thu va bao cao do an.  
In this update, the AI Study Buddy backend was standardized and completed to better support frontend integration, testing, and thesis reporting.

Cac thay doi chinh tap trung vao bon nhom: chuan hoa API, on dinh runtime, tang kha nang quan sat he thong, va bo sung tai lieu/tap request san dung.  
The main changes focused on four areas: API standardization, runtime stability, improved observability, and ready-to-use documentation/request collections.

Ve API, nhom `progress` da duoc chuyen sang co che lay thong tin nguoi dung hien tai thong qua JWT, thay vi truyen `userId` tu client. Cach nay dong bo hon voi cac module `documents` va `quizzes`, dong thoi tang tinh bao mat va giam sai sot khi frontend goi API. Cac route moi bao gom `GET /progress/me`, `GET /progress/timeline`, `POST /progress/init`, va `POST /progress/complete`.  
For the API layer, the `progress` module was moved to a JWT-based current-user model instead of accepting `userId` from the client. This is now aligned with the `documents` and `quizzes` modules, improving security and reducing frontend integration errors. The new routes are `GET /progress/me`, `GET /progress/timeline`, `POST /progress/init`, and `POST /progress/complete`.

Ve tinh on dinh, mot so loi TypeScript va runtime da duoc xu ly, bao gom loi strict initialization trong entity, van de typing cua file upload, van de nullable content trong flow chat tai lieu, va loi TypeORM map kieu cot `filePath`. Sau khi sua, backend build thanh cong va co the khoi dong on dinh.  
For stability, several TypeScript and runtime issues were fixed, including strict initialization errors in entities, upload file typing issues, nullable document content in the chat flow, and TypeORM column mapping for `filePath`. After the fixes, the backend builds successfully and starts reliably.

Ve observability, he thong da bo sung global HTTP logging interceptor de in ra request/response trong terminal. Moi request se hien thi method, URL, body, params, query, status code, thoi gian xu ly va du lieu tra ve. Dieu nay giup viec debug va demo he thong de hon rat nhieu.  
For observability, a global HTTP logging interceptor was added to print request/response data in the terminal. Each request now shows method, URL, body, params, query, status code, processing time, and response data. This makes debugging and demos much easier.

Cuoi cung, tai lieu API da duoc viet lai bang tieng Anh, dong bo voi code hien tai va bo sung huong dan bien moi truong database. Collection Postman va Bruno cung da duoc tao san de import va test nhanh.  
Finally, the API documentation was rewritten in English, aligned with the current codebase, and updated with database environment variable guidance. Postman and Bruno collections were also created for quick import and testing.

## 2. Bang Before / After / Comparison Table

| Hang muc / Item | Truoc cap nhat / Before | Sau cap nhat / After |
|---|---|---|
| Progress API | Truyen `userId` tu URL/body, chua dong bo JWT | Dung JWT de lay user hien tai, route chuan hoa thanh `/progress/me`, `/progress/timeline`, `/progress/init`, `/progress/complete` |
| Logging | Chi co log khoi dong, khong co request/response log | Co global HTTP logging interceptor, in request/response/error va thoi gian xu ly |
| TypeScript/Entity | Loi strict initialization, typing upload chua on | Da sua entity voi definite assignment, upload type rieng, catch `unknown`, va mapping cot DB ro rang |
| Database config | Chua mo ta ro trong tai lieu | Da chuan hoa huong dan `DB_*` cho TypeORM va `DATABASE_URL` cho PGVector |
| API documentation | Mot phan con tieng Viet, chua dong bo | Toan bo tai lieu API da duoc viet lai bang tieng Anh va dong bo voi endpoint hien tai |
| Integration artifacts | Chua co bo request san dung day du | Da co Postman collection, Postman environment, va Bruno collection |

## 3. Bang Chung Kiem Thu / Verification Evidence

### 3.1. Kiem tra build / Build verification

- Lenh / Command: `npm run build`
- Ket qua / Result: build thanh cong / build succeeded
- Y nghia / Meaning: Xac nhan code sau khi sua van bi loi compile / confirms the code compiles successfully after the fixes

### 3.2. Kiem tra chay backend / Backend runtime check

- Lenh / Command: `npm run start:dev`
- Ket qua / Result: backend khoi dong thanh cong sau khi giai phong port bi trung va sua cac loi runtime / backend started successfully after freeing the occupied port and fixing runtime issues
- Y nghia / Meaning: Xac nhan he thong co the van hanh o che do phat trien / confirms the system runs in development mode

### 3.3. Kiem tra API bang Postman / API test with Postman

- Endpoint test: `POST /ai/ask`
- Request body:

```json
{
  "question": "Chao Buddy"
}
```

- Ket qua tra ve / Response:

```json
{
  "answer": "Hello! How can I assist you with your studies today?",
  "sources": []
}
```

- Y nghia / Meaning: Xac nhan API AI hoat dong va co response hop le / confirms the AI API works and returns a valid response

### 3.4. Kiem tra log backend / Backend logging check

- Da them log request/response tai terminal backend / Request-response logs were added to the backend terminal
- Noi dung log bao gom / Log content includes:
  - Method, URL
  - Body, params, query
  - Status code
  - Response data
  - Thoi gian xu ly / Processing time

### 3.5. Chung nhan source control / Source control confirmation

- Da commit va push thanh cong len `origin/main` / Successfully committed and pushed to `origin/main`
- Commit: `8b59463`
- Message commit / Commit message:

```text
feat(api): standardize backend contracts and add integration collections
```

### 3.6. File bang chung lien quan / Related evidence files

- Tai lieu API tieng Anh / English API documentation: [API_FRONTEND_RAG_LLM.md](API_FRONTEND_RAG_LLM.md)
- Postman collection: `postman/AI-Study-Buddy.postman_collection.json`
- Bruno collection: thu muc `bruno/`

---

**Ghi chu cho bao cao / Report note:**  
Neu can viet ngan gon hon, co the dung doan tom tat sau:  
If you need a shorter version, you can use the summary below:

Trong dot cap nhat nay, backend AI Study Buddy da duoc chuan hoa API, cai thien runtime stability, them HTTP logging de ho tro debug, va bo sung tai lieu test san dung. Nhom progress duoc chuyen sang mo hinh JWT-based de dong bo voi cac module con lai. Dong thoi, he thong da duoc kiem tra build, chay dev server, va test API thanh cong qua Postman.  
In this update, the AI Study Buddy backend was standardized, runtime stability was improved, HTTP logging was added for debugging, and ready-to-use test documentation was provided. The progress module was moved to a JWT-based model to match the other modules. The system was also verified through successful build, dev server startup, and Postman API testing.
