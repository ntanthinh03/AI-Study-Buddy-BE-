# FE Integration - Password APIs (Forgot + Change)

Canonical endpoint naming and global FE order: [FE_API_INDEX.md](FE_API_INDEX.md)

Tai lieu nay mo ta 2 API lien quan mat khau de FE tich hop:

1. Quen mat khau qua email + phone
2. Doi mat khau khi da dang nhap

## 1) POST /auth/forgot-password

### Muc dich
Cho phep reset mat khau khi user cung cap dung:
- email
- phoneNumber
- newPassword

Backend se:
- Xac thuc email + phone
- Hash mat khau moi va cap nhat vao bang users
- Luu lich su vao bang password_resets

### Auth
Khong can Bearer token.

### Request body
```json
{
  "email": "user@example.com",
  "phoneNumber": "0909123456",
  "newPassword": "newPassword123"
}
```

### Success response
```json
{
  "message": "Đặt lại mật khẩu thành công"
}
```

### Error cases
- 404: Khong tim thay tai khoan voi email nay
- 400: Tai khoan chua co so dien thoai de xac thuc
- 401: Email hoac so dien thoai khong chinh xac

## 2) POST /auth/change-password

### Muc dich
User da dang nhap co the doi mat khau bang mat khau cu.

### Auth
Bat buoc Bearer token.

Header:
```text
Authorization: Bearer <access_token>
```

### Request body
```json
{
  "oldPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

### Success response
```json
{
  "message": "Đổi mật khẩu thành công"
}
```

### Error cases
- 401: Unauthorized (token sai/het han)
- 401: Mat khau cu khong chinh xac
- 404: Khong tim thay user
- 400: Tai khoan khong co mat khau local

### Backend notes
- `POST /auth/login` returns `access_token` and a `user` object with `id`, `email`, `fullName`, and `phoneNumber`.
- The password change flow does not revoke the current token automatically.

## 3) Luu y cho FE

- Khong log plaintext password tren app logs.
- Bat buoc validate password length >= 6 truoc khi goi API.
- Sau khi doi mat khau thanh cong, FE nen giu token hien tai hoac cho user dang nhap lai theo chinh sach cua app.
- Neu API tra 401 do token het han, clear token va dieu huong ve man login.

## 4) Database lien quan

- users.password: duoc cap nhat sau khi reset/doi mat khau.
- password_resets: luu lich su reset mat khau theo email + phone va ket qua.
