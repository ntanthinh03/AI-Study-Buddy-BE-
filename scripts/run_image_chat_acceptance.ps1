param(
  [string]$BaseUrl = 'http://localhost:3001',
  [string]$ImagePath = 'c:/Users/Admin/server-study-buddy/uploads/test-image.png',
  [string]$ResultPath = 'IMAGE_CHAT_ACCEPTANCE_RESULT.md'
)

$ErrorActionPreference = 'Stop'

function Test-VisionModelInstalled {
  $tagsRaw = curl.exe -s http://localhost:11434/api/tags
  if (-not $tagsRaw) { return $false }
  $tags = $tagsRaw | ConvertFrom-Json
  $names = @($tags.models | ForEach-Object { $_.name })
  return $names -contains 'llama3.2-vision:11b'
}

function New-TestUser {
  $email = 'imgchat' + (Get-Date -Format 'yyyyMMddHHmmss') + '@example.com'
  $password = '123456'
  return [PSCustomObject]@{ email = $email; password = $password }
}

$result = [ordered]@{
  date = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  baseUrl = $BaseUrl
  imagePath = $ImagePath
  precheck = [ordered]@{
    imageFileExists = (Test-Path $ImagePath)
    visionModelInstalled = $false
  }
  steps = [ordered]@{}
  pass = $false
  note = ''
}

if (-not $result.precheck.imageFileExists) {
  $result.note = 'Image file not found'
  $result | ConvertTo-Json -Depth 8
  exit 1
}

$result.precheck.visionModelInstalled = Test-VisionModelInstalled
if (-not $result.precheck.visionModelInstalled) {
  $result.note = 'Vision model llama3.2-vision:11b is not installed yet'
  $result | ConvertTo-Json -Depth 8
  exit 2
}

try {
  $user = New-TestUser

  $registerBody = @{
    email = $user.email
    password = $user.password
    fullName = 'Image Chat Acceptance'
    phoneNumber = '0900000002'
  } | ConvertTo-Json
  $null = Invoke-RestMethod -Method Post -Uri ($BaseUrl + '/auth/register') -ContentType 'application/json' -Body $registerBody

  $loginBody = @{ email = $user.email; password = $user.password } | ConvertTo-Json
  $login = Invoke-RestMethod -Method Post -Uri ($BaseUrl + '/auth/login') -ContentType 'application/json' -Body $loginBody
  $token = $login.access_token
  $headers = @{ Authorization = ('Bearer ' + $token) }

  $firstRaw = curl.exe -s -X POST ($BaseUrl + '/chat/ask-image') -H ('Authorization: Bearer ' + $token) -F 'question=What do you see in this image?' -F 'title=Image Chat Acceptance' -F ('image=@' + $ImagePath + ';type=image/png')
  $first = $firstRaw | ConvertFrom-Json

  $secondRaw = curl.exe -s -X POST ($BaseUrl + '/chat/ask-image') -H ('Authorization: Bearer ' + $token) -F 'question=Can you summarize this image in one sentence?' -F ('conversationId=' + $first.conversationId) -F ('image=@' + $ImagePath + ';type=image/png')
  $second = $secondRaw | ConvertFrom-Json

  $messages = Invoke-RestMethod -Method Get -Uri ($BaseUrl + '/conversations/' + $first.conversationId + '/messages') -Headers $headers
  $imagePayload = Invoke-RestMethod -Method Get -Uri ($BaseUrl + '/chat/messages/' + $first.messageId + '/image') -Headers $headers

  $qaRows = @($messages | Where-Object { $_.question -and $_.answer })

  $result.steps = [ordered]@{
    tokenIssued = [bool]$token
    firstAsk = [ordered]@{
      conversationId = $first.conversationId
      messageId = $first.messageId
      hasQuestion = [bool]$first.question
      hasAnswer = [bool]$first.answer
      hasCreatedAt = [bool]$first.createdAt
    }
    secondAsk = [ordered]@{
      conversationId = $second.conversationId
      messageId = $second.messageId
      sameConversationId = ($first.conversationId -eq $second.conversationId)
      newMessageId = ($first.messageId -ne $second.messageId)
    }
    thread = [ordered]@{
      totalRows = @($messages).Count
      qaRows = @($qaRows).Count
      exactTwoQaRows = (@($qaRows).Count -eq 2)
    }
    image = [ordered]@{
      firstMessageHasImageMimeType = [bool]$messages[0].imageMimeType
      fetchMimeType = $imagePayload.mimeType
      base64Length = ($imagePayload.base64).Length
    }
  }

  $result.pass = ($result.steps.secondAsk.sameConversationId -and $result.steps.secondAsk.newMessageId -and $result.steps.thread.exactTwoQaRows -and ($result.steps.image.base64Length -gt 0))
  $result.note = if ($result.pass) { 'PASS' } else { 'FAIL: check steps for details' }

  $json = $result | ConvertTo-Json -Depth 10
  Write-Output $json

  $md = @()
  $md += '# Image Chat Acceptance Result'
  $md += ''
  $md += ('Date: ' + (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))
  $md += ('Base URL: ' + $BaseUrl)
  $md += ('Result: ' + $result.note)
  $md += ''
  $md += '## Summary'
  $md += ('- tokenIssued: ' + $result.steps.tokenIssued)
  $md += ('- sameConversationId: ' + $result.steps.secondAsk.sameConversationId)
  $md += ('- newMessageId: ' + $result.steps.secondAsk.newMessageId)
  $md += ('- totalRows: ' + $result.steps.thread.totalRows)
  $md += ('- qaRows: ' + $result.steps.thread.qaRows)
  $md += ('- exactTwoQaRows: ' + $result.steps.thread.exactTwoQaRows)
  $md += ('- imageFetchMimeType: ' + $result.steps.image.fetchMimeType)
  $md += ('- imageBase64Length: ' + $result.steps.image.base64Length)
  $md += ''
  $md += '## Raw JSON'
  $md += '```json'
  $md += $json
  $md += '```'

  Set-Content -Path $ResultPath -Value ($md -join "`r`n") -Encoding UTF8
} catch {
  $result.note = ('FAIL: ' + $_.Exception.Message)
  $json = $result | ConvertTo-Json -Depth 10
  Write-Output $json
  exit 3
}
