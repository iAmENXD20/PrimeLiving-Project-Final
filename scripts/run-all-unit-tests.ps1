$ErrorActionPreference = "Stop"

$runStart = Get-Date

function Start-Phase {
	param(
		[string]$Title,
		[int]$Step,
		[int]$Total
	)

	$percent = [int](($Step / $Total) * 100)
	Write-Progress -Activity "Unit Test Pipeline" -Status "$Title ($Step/$Total)" -PercentComplete $percent
	Write-Host ""
	Write-Host "=============================================" -ForegroundColor DarkCyan
	Write-Host "[STEP $Step/$Total] $Title" -ForegroundColor Cyan
	Write-Host "=============================================" -ForegroundColor DarkCyan
}

function End-Phase {
	param(
		[string]$Title,
		[datetime]$StartTime
	)

	$seconds = [math]::Round(((Get-Date) - $StartTime).TotalSeconds, 2)
	Write-Host "Completed: $Title in ${seconds}s" -ForegroundColor DarkGreen
}

$totalSteps = 2

$backendStart = Get-Date
Start-Phase -Title "Running backend unit tests" -Step 1 -Total $totalSteps
cmd /c "npm run test:unit --prefix backend"
if ($LASTEXITCODE -ne 0) {
	Write-Progress -Activity "Unit Test Pipeline" -Completed
	throw "Backend unit tests failed."
}
End-Phase -Title "Backend unit tests" -StartTime $backendStart

$frontendStart = Get-Date
Start-Phase -Title "Running frontend unit tests" -Step 2 -Total $totalSteps
cmd /c "npm run test:unit --prefix frontend"
if ($LASTEXITCODE -ne 0) {
	Write-Progress -Activity "Unit Test Pipeline" -Completed
	throw "Frontend unit tests failed."
}
End-Phase -Title "Frontend unit tests" -StartTime $frontendStart

Write-Progress -Activity "Unit Test Pipeline" -Completed

$totalSeconds = [math]::Round(((Get-Date) - $runStart).TotalSeconds, 2)
Write-Host ""
Write-Host "=============================================" -ForegroundColor DarkGreen
Write-Host "All unit tests passed in ${totalSeconds}s" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor DarkGreen
