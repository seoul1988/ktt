@echo off
setlocal

set "TARGET=C:\ktt-pwa\app\community\news\detail\[id]\page.tsx"

if not exist "%TARGET%" (
  echo File not found:
  echo %TARGET%
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p = 'C:\ktt-pwa\app\community\news\detail\[id]\page.tsx';" ^
  "$lines = [System.Collections.Generic.List[string]](Get-Content -LiteralPath $p);" ^
  "$lines[6] = 'import CommunityBottomNav from ""@/app/components/CommunityBottomNav"";';" ^
  "$lines[7] = 'import { supabase } from ""@/lib/supabase"";';" ^
  "[System.IO.File]::WriteAllLines($p, $lines, [System.Text.UTF8Encoding]::new($false));"

echo.
echo Updated imports:
findstr /n /c:"CommunityBottomNav" /c:"supabase" "%TARGET%"
echo.
echo Done.
pause
