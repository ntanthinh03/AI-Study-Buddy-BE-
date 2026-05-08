$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$email = "testsubmit-$timestamp@example.com"
$pass = "Test@123456"
$baseUrl = "http://localhost:3002"

Write-Host "=== End-to-End Submit Flow Test ===" -ForegroundColor Cyan
Write-Host "Email: $email" -ForegroundColor Yellow
Write-Host ""

try {
    # 1. Register
    Write-Host "[1/6] Register user..." -ForegroundColor Green
    $reg = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post `
        -Body (@{email = $email; password = $pass; fullName = "Test User"; phoneNumber = "0123456789"} | ConvertTo-Json) `
        -ContentType "application/json" -TimeoutSec 10
    Write-Host "  PASS" -ForegroundColor Green

    # 2. Login
    Write-Host "[2/6] Login..." -ForegroundColor Green
    $login = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post `
        -Body (@{email = $email; password = $pass} | ConvertTo-Json) `
        -ContentType "application/json" -TimeoutSec 10
    $token = $login.access_token
    Write-Host "  PASS" -ForegroundColor Green

    # 3. Get daily session
    Write-Host "[3/6] Get daily session..." -ForegroundColor Green
    $daily = Invoke-RestMethod -Uri "$baseUrl/study-sessions/daily" -Method Get `
        -Headers @{"Authorization" = "Bearer $token"} -TimeoutSec 10
    $sessionId = $daily.id
    $quizzes = @($daily.content.quizQuestions).Count
    $flashcards = @($daily.content.flashcards).Count
    Write-Host "  Session ID: $sessionId" -ForegroundColor Gray
    Write-Host "  Content: $quizzes quizzes, $flashcards flashcards" -ForegroundColor Gray
    Write-Host "  Status: $($daily.status)" -ForegroundColor Gray
    Write-Host "  PASS" -ForegroundColor Green

    # 4. Submit session (with 0 correct out of 0 total for empty session)
    Write-Host "[4/6] Submit session..." -ForegroundColor Green
    $submit = Invoke-RestMethod -Uri "$baseUrl/study-sessions/$sessionId/submit" -Method Post `
        -Body (@{correctAnswers = 0; totalQuestions = 0} | ConvertTo-Json) `
        -Headers @{"Authorization" = "Bearer $token"} `
        -ContentType "application/json" -TimeoutSec 10
    Write-Host "  Response type: UserStats" -ForegroundColor Gray
    Write-Host "  Total XP: $($submit.totalXP)" -ForegroundColor Yellow
    Write-Host "  Current Streak: $($submit.currentStreak)" -ForegroundColor Yellow
    Write-Host "  Level: $($submit.level)" -ForegroundColor Yellow
    Write-Host "  PASS" -ForegroundColor Green

    # 5. Verify stats were updated
    Write-Host "[5/6] Verify stats update..." -ForegroundColor Green
    if ($submit.totalXP -eq 20) {
        Write-Host "  XP Calculation: CORRECT (20 = 0*10 + 20)" -ForegroundColor Green
    } else {
        Write-Host "  XP Calculation: ERROR (expected 20, got $($submit.totalXP))" -ForegroundColor Red
        exit 1
    }
    
    if ($submit.currentStreak -eq 1) {
        Write-Host "  Streak Calculation: CORRECT (streak = 1)" -ForegroundColor Green
    } else {
        Write-Host "  Streak Calculation: ERROR (expected 1, got $($submit.currentStreak))" -ForegroundColor Red
        exit 1
    }
    
    if ($submit.level -eq 1) {
        Write-Host "  Level Calculation: CORRECT (level = 1)" -ForegroundColor Green
    } else {
        Write-Host "  Level Calculation: ERROR (expected 1, got $($submit.level))" -ForegroundColor Red
        exit 1
    }
    Write-Host "  PASS" -ForegroundColor Green

    # 6. Get user stats to verify persistence
    Write-Host "[6/6] Verify stats persistence..." -ForegroundColor Green
    $stats = Invoke-RestMethod -Uri "$baseUrl/study-sessions/stats" -Method Get `
        -Headers @{"Authorization" = "Bearer $token"} -TimeoutSec 10
    Write-Host "  Fetched stats from DB" -ForegroundColor Gray
    Write-Host "  Total XP (DB): $($stats.totalXP)" -ForegroundColor Yellow
    Write-Host "  Streak (DB): $($stats.currentStreak)" -ForegroundColor Yellow
    
    if ($stats.totalXP -eq 20 -and $stats.currentStreak -eq 1) {
        Write-Host "  PASS" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: Stats not persisted correctly" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "*** ALL TESTS PASSED ***" -ForegroundColor Cyan
    Write-Host "[OK] Submit endpoint is fully functional" -ForegroundColor Green
    Write-Host "[OK] Stats are correctly calculated and persisted" -ForegroundColor Green
    exit 0

} catch {
    Write-Host ""
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}
