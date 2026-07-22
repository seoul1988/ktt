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
  "$c = [System.IO.File]::ReadAllText($p);" ^
  "$c = $c -replace [regex]::Escape('import CommunityBottomNav from ""../../../components/CommunityBottomNav"";'), 'import CommunityBottomNav from ""@/app/components/CommunityBottomNav"";';" ^
  "$c = $c -replace [regex]::Escape('import { supabase } from ""../../../../lib/supabase"";'), 'import { supabase } from ""@/lib/supabase"";';" ^
  "[System.IO.File]::WriteAllText($p, $c, [System.Text.UTF8Encoding]::new($false));"

echo.
echo Updated imports:
findstr /n /c:"CommunityBottomNav" /c:"supabase" "%TARGET%"
echo.
echo Done.
pause
