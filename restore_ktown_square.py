from pathlib import Path
import sys
root=Path(__file__).resolve().parent
if not (root/'package.json').exists():
    sys.exit('이 파일을 C:\\ktt-pwa 폴더에 넣고 실행하세요.')
api=root/'app/api/owner/business/[id]/order-payment-settings/route.ts'
page=root/'app/owner/business/[id]/menu/page.tsx'
a=api.read_text(encoding='utf-8'); p=page.read_text(encoding='utf-8')
if 'manualSquareCredentials === true' in a or 'squareManualAccessTokenInput' in p:
    sys.exit('이미 패치가 적용된 것으로 보입니다. 중복 적용하지 않았습니다.')
old='    // Square credentials are never accepted from the browser anymore.\n    if (body?.paymentProvider === "square") {'
new='''    // Manual Square connection: validate credentials before changing the stored account.
    if (body?.paymentProvider === "square" && body?.manualSquareCredentials === true) {
      const accessToken = String(body?.squareAccessToken || "").trim();
      const locationId = String(body?.squareLocationId || "").trim();
      const applicationId = String(body?.squareApplicationId || "").trim();
      if (!accessToken || !locationId) {
        return NextResponse.json({ error: "Square Access Token과 Location ID를 입력하세요." }, { status: 400 });
      }
      if (accessToken.length > 4096 || locationId.length > 255 || applicationId.length > 255) {
        return NextResponse.json({ error: "Square 입력값이 너무 깁니다." }, { status: 400 });
      }
      const configuredAppId = process.env.SQUARE_APPLICATION_ID || "";
      if (applicationId && configuredAppId && applicationId !== configuredAppId) {
        return NextResponse.json({ error: "Application ID가 KTown Square 앱과 일치하지 않습니다." }, { status: 400 });
      }
      const squareBase = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase() === "sandbox"
        ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
      const headers = { Authorization: `Bearer ${accessToken}`, "Square-Version": "2025-10-16", Accept: "application/json" };
      const [merchantResponse, locationResponse] = await Promise.all([
        fetch(`${squareBase}/v2/merchants/me`, { headers, cache: "no-store", signal: AbortSignal.timeout(10000) }),
        fetch(`${squareBase}/v2/locations/${encodeURIComponent(locationId)}`, { headers, cache: "no-store", signal: AbortSignal.timeout(10000) }),
      ]);
      if (!merchantResponse.ok || !locationResponse.ok) {
        return NextResponse.json({ error: "Square 인증 실패: Access Token과 Location ID를 확인하세요. 기존 설정은 유지됩니다." }, { status: 400 });
      }
      const merchantData = await merchantResponse.json();
      const locationData = await locationResponse.json();
      const merchantId = String(merchantData?.merchant?.id || "").trim();
      const location = locationData?.location;
      if (!merchantId || !location?.id || (location.merchant_id && location.merchant_id !== merchantId)) {
        return NextResponse.json({ error: "Square 가맹점과 매장 정보가 일치하지 않습니다." }, { status: 400 });
      }
      const { data, error } = await supabase.from("restaurant_order_private_settings").upsert({
        business_id: businessId,
        payment_provider: "square",
        square_access_token: accessToken,
        square_refresh_token: null,
        square_token_expires_at: null,
        square_merchant_id: merchantId,
        square_merchant_name: String(merchantData?.merchant?.business_name || ""),
        square_location_id: locationId,
        square_location_name: String(location?.name || ""),
        updated_at: new Date().toISOString(),
      }, { onConflict: "business_id" })
      .select("payment_provider,stripe_secret_key,stripe_webhook_secret,square_access_token,square_merchant_id,square_merchant_name,square_location_id,square_location_name")
      .single();
      if (error) throw error;
      return NextResponse.json(buildResponse(data));
    }

    if (body?.paymentProvider === "square") {'''
if a.count(old)!=1:sys.exit('API 코드 위치가 예상과 달라 중단했습니다. 파일은 변경하지 않았습니다.')
a=a.replace(old,new)
anchor='  const [squareConfigured, setSquareConfigured] = useState(false);'
if p.count(anchor)!=1:sys.exit('화면 상태 위치를 찾지 못했습니다.')
p=p.replace(anchor,'''  const [squareManualApplicationIdInput, setSquareManualApplicationIdInput] = useState("");
  const [squareManualLocationIdInput, setSquareManualLocationIdInput] = useState("");
  const [squareManualAccessTokenInput, setSquareManualAccessTokenInput] = useState("");
  const [squareManualOpen, setSquareManualOpen] = useState(false);
  const [savingSquareManual, setSavingSquareManual] = useState(false);
'''+anchor)
anchor='  async function connectSquare() {'
if p.count(anchor)!=1:sys.exit('Square 연결 함수 위치를 찾지 못했습니다.')
p=p.replace(anchor,'''  async function saveSquareManualCredentials() {
    if (savingSquareManual) return;
    if (!squareManualAccessTokenInput.trim() || !squareManualLocationIdInput.trim()) {
      setMessage("Square Access Token과 Location ID를 입력하세요.");
      return;
    }
    if (squareConfigured && !window.confirm("기존 Square 연결 정보를 새 API 정보로 교체하시겠습니까?")) return;
    setSavingSquareManual(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/owner/business/${businessId}/order-payment-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          paymentProvider: "square", manualSquareCredentials: true,
          squareApplicationId: squareManualApplicationIdInput.trim(),
          squareLocationId: squareManualLocationIdInput.trim(),
          squareAccessToken: squareManualAccessTokenInput.trim(),
        }),
      });
      const data = await readApiJson(response);
      if (!response.ok) throw new Error(data?.error || "Square 설정 저장 실패");
      setSquareConfigured(data?.squareConfigured === true);
      setSquareMerchantName(String(data?.squareMerchantName || ""));
      setSquareMerchantId(String(data?.squareMerchantId || ""));
      setSquareLocationName(String(data?.squareLocationName || ""));
      setSquareLocationId(String(data?.squareLocationId || ""));
      setSquareManualAccessTokenInput("");
      setSquareManualOpen(false);
      setMessage("✓ Square API 연결 정보가 저장되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? `Square 연결 실패: ${error.message}` : "Square 연결 실패");
    } finally {
      setSavingSquareManual(false);
    }
  }

'''+anchor)
anchor='                      API Key를 입력할 필요가 없습니다. Square 계정으로 로그인해서 연결만 하세요.'
if p.count(anchor)!=1:sys.exit('Square 설명 위치를 찾지 못했습니다.')
p=p.replace(anchor,'                      Square 로그인으로 연결하거나 API 정보를 직접 입력할 수 있습니다.')
anchor='                {squareConfigured ? ('
# scope specifically after Square Account heading
start=p.index('>Square Account</p>'); pos=p.find(anchor,start)
if pos<0 or pos-start>1800:sys.exit('Square 카드 입력 위치를 찾지 못했습니다.')
form='''                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <button type="button" onClick={() => { setSquareManualOpen((v) => !v); setSquareManualLocationIdInput(squareLocationId); }}
                    className="text-sm font-black text-emerald-800">
                    {squareManualOpen ? "API 직접 입력 닫기 ▲" : "Square API 직접 입력 / 수정 ▼"}
                  </button>
                  {squareManualOpen ? (
                    <div className="mt-3 grid gap-3">
                      <label className="text-xs font-bold text-gray-700">Square Application ID (선택 입력)
                        <input type="text" autoComplete="off" value={squareManualApplicationIdInput} onChange={(e) => setSquareManualApplicationIdInput(e.target.value)} placeholder="sq0idp-..."
                          className="mt-1 w-full rounded-lg border p-3 text-sm" />
                      </label>
                      <label className="text-xs font-bold text-gray-700">Square Location ID
                        <input type="text" autoComplete="off" value={squareManualLocationIdInput} onChange={(e) => setSquareManualLocationIdInput(e.target.value)} placeholder="Location ID"
                          className="mt-1 w-full rounded-lg border p-3 text-sm" />
                      </label>
                      <label className="text-xs font-bold text-gray-700">Square Access Token
                        <input type="password" autoComplete="new-password" value={squareManualAccessTokenInput} onChange={(e) => setSquareManualAccessTokenInput(e.target.value)} placeholder="새 Access Token (기존 토큰은 표시하지 않음)"
                          className="mt-1 w-full rounded-lg border p-3 text-sm" />
                      </label>
                      <p className="text-xs text-gray-600">기존 연결을 수정할 때도 새 Access Token을 입력해야 합니다. 저장 전에 Square에서 유효성을 확인합니다.</p>
                      <button type="button" onClick={() => void saveSquareManualCredentials()} disabled={savingSquareManual}
                        className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                        {savingSquareManual ? "검증 및 저장 중..." : "SQUARE API 연결 저장"}
                      </button>
                    </div>
                  ) : null}
                </div>

'''
p=p[:pos]+form+p[pos:]
api.write_text(a,encoding='utf-8');page.write_text(p,encoding='utf-8')
print('패치 완료: API와 메뉴 관리 화면 수정. git diff 확인 후 빌드/커밋하세요.')
