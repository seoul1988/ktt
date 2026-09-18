"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

function moneyFromCents(value: unknown) {
  const cents = Number(value || 0);
  if (!Number.isFinite(cents)) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

function minutesFromSeconds(value: unknown) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  return `${Math.max(1, Math.round(seconds / 60))}분`;
}

export default function UberDirectTestPage() {
  const params = useParams();
  const businessId = String(params?.id || "");

  const [orderId, setOrderId] = useState("127");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState<any>(null);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

  async function callTestApi(action: "quote" | "dispatch") {
    const response = await fetch(
      `/api/owner/business/${businessId}/uber-direct-test`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: Number(orderId),
          action,
        }),
      },
    );

    const data = await response.json().catch(() => ({
      ok: false,
      error: `Invalid server response (${response.status})`,
    }));

    return {
      httpStatus: response.status,
      ...data,
    };
  }

  async function getUberQuote() {
    if (!orderId.trim()) {
      alert("Order ID를 입력하세요.");
      return;
    }

    setQuoteLoading(true);
    setQuoteResult(null);
    setDispatchResult(null);

    try {
      const data = await callTestApi("quote");
      setQuoteResult(data);
    } catch (error) {
      setQuoteResult({
        ok: false,
        error: error instanceof Error ? error.message : "Network error",
      });
    } finally {
      setQuoteLoading(false);
    }
  }

  async function dispatchUber() {
    if (!quoteResult?.ok || !quoteResult?.quote?.id) {
      alert("먼저 Uber 배달료를 확인하세요.");
      return;
    }

    const confirmed = window.confirm(
      `이제 실제 Uber Direct 배달을 생성합니다.\n\n` +
        `Order ID: ${orderId}\n` +
        `Uber 예상 배달료: ${moneyFromCents(
          quoteResult?.quote?.uberFeeCents,
        )}\n\n` +
        `이 단계에서는 실제 기사가 배정될 수 있고 Uber 배달료가 발생할 수 있습니다.\n` +
        `Square 결제, Square 영수증, SMS는 실행하지 않습니다.\n\n` +
        `실제 Uber 기사를 호출하시겠습니까?`,
    );

    if (!confirmed) return;

    setDispatchLoading(true);
    setDispatchResult(null);

    try {
      const data = await callTestApi("dispatch");
      setDispatchResult(data);
    } catch (error) {
      setDispatchResult({
        ok: false,
        error: error instanceof Error ? error.message : "Network error",
      });
    } finally {
      setDispatchLoading(false);
    }
  }

  const quote = quoteResult?.quote;
  const finalResult = dispatchResult || quoteResult;
  const dispatchSuccess =
    dispatchResult?.ok === true &&
    (dispatchResult?.order?.delivery_external_id ||
      dispatchResult?.uberResult?.deliveryId ||
      dispatchResult?.alreadyDispatched);

  return (
    <main
      style={{
        maxWidth: 800,
        margin: "40px auto",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Uber Direct TEST</h1>

      <div
        style={{
          background: "#e7f3ff",
          border: "1px solid #9ec5fe",
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <strong>2단계 TEST MODE</strong>
        <p style={{ marginBottom: 0, lineHeight: 1.6 }}>
          ① 먼저 픽업/배달 주소로 Uber 예상 배달료만 확인합니다.
          <br />
          이 단계에서는 Uber 기사를 호출하지 않습니다.
          <br />
          ② 배달료를 확인한 뒤 별도 버튼을 눌러야 실제 Uber 배달이 생성됩니다.
          <br />
          Square 결제, Square 영수증, SMS는 실행하지 않습니다.
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 6 }}>Business ID</div>
        <input
          value={businessId}
          disabled
          style={{
            width: "100%",
            padding: 12,
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 6 }}>Order ID</div>
        <input
          value={orderId}
          onChange={(e) => {
            setOrderId(e.target.value);
            setQuoteResult(null);
            setDispatchResult(null);
          }}
          inputMode="numeric"
          style={{
            width: "100%",
            padding: 12,
            boxSizing: "border-box",
            fontSize: 18,
          }}
        />
      </div>

      <button
        type="button"
        disabled={quoteLoading || dispatchLoading}
        onClick={getUberQuote}
        style={{
          width: "100%",
          padding: "16px 20px",
          fontSize: 18,
          fontWeight: 700,
          cursor: quoteLoading ? "wait" : "pointer",
        }}
      >
        {quoteLoading ? "배달료 확인 중..." : "① UBER 배달료 확인"}
      </button>

      {quoteResult && (
        <section
          style={{
            marginTop: 24,
            padding: 20,
            border: `2px solid ${quoteResult.ok ? "#198754" : "#dc3545"}`,
            borderRadius: 8,
          }}
        >
          <h2>{quoteResult.ok ? "Uber 배달료 확인" : "Quote 오류"}</h2>

          {quoteResult?.error && (
            <div
              style={{
                padding: 12,
                background: "#f8d7da",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {quoteResult.error}
            </div>
          )}

          {quoteResult?.pickupAddress && (
            <div style={{ marginTop: 16 }}>
              <strong>픽업 주소</strong>
              <div style={{ marginTop: 4 }}>{quoteResult.pickupAddress}</div>
            </div>
          )}

          {quoteResult?.dropoffAddress && (
            <div style={{ marginTop: 16 }}>
              <strong>배달 주소</strong>
              <div style={{ marginTop: 4 }}>{quoteResult.dropoffAddress}</div>
            </div>
          )}

          {quoteResult?.ok && quote && (
            <>
              <div
                style={{
                  marginTop: 20,
                  padding: 18,
                  background: "#f8f9fa",
                  borderRadius: 8,
                  fontSize: 18,
                  lineHeight: 1.8,
                }}
              >
                <div>
                  <strong>Uber 예상 배달료:</strong>{" "}
                  {moneyFromCents(quote.uberFeeCents)}
                </div>

                {Number(quote.markupCents || 0) > 0 && (
                  <>
                    <div>
                      <strong>KTown Markup:</strong>{" "}
                      {moneyFromCents(quote.markupCents)}
                    </div>
                    <div>
                      <strong>고객 배달료:</strong>{" "}
                      {moneyFromCents(quote.customerFeeCents)}
                    </div>
                  </>
                )}

                <div>
                  <strong>예상 시간:</strong>{" "}
                  {minutesFromSeconds(quote.duration)}
                </div>

                <div>
                  <strong>Quote ID:</strong> {quote.id || "-"}
                </div>

                <div>
                  <strong>Quote 만료:</strong>{" "}
                  {quote.expires
                    ? new Date(quote.expires).toLocaleString()
                    : "-"}
                </div>
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  background: "#d1e7dd",
                  borderRadius: 8,
                  fontWeight: 700,
                }}
              >
                ✓ 아직 Uber 기사를 호출하지 않았습니다.
              </div>

              <button
                type="button"
                disabled={dispatchLoading}
                onClick={dispatchUber}
                style={{
                  width: "100%",
                  marginTop: 20,
                  padding: "16px 20px",
                  fontSize: 18,
                  fontWeight: 700,
                  cursor: dispatchLoading ? "wait" : "pointer",
                }}
              >
                {dispatchLoading
                  ? "실제 Uber 기사 호출 중..."
                  : "② 실제 UBER 기사 호출"}
              </button>
            </>
          )}
        </section>
      )}

      {dispatchResult && (
        <section
          style={{
            marginTop: 24,
            padding: 20,
            border: `2px solid ${
              dispatchSuccess ? "#198754" : "#dc3545"
            }`,
            borderRadius: 8,
          }}
        >
          <h2>
            {dispatchSuccess
              ? "Uber Direct 생성 성공"
              : "Uber Direct 호출 결과"}
          </h2>

          {dispatchResult?.error && (
            <div
              style={{
                padding: 12,
                background: "#f8d7da",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {dispatchResult.error}
            </div>
          )}

          {dispatchResult?.order && (
            <div style={{ marginTop: 20, lineHeight: 1.7 }}>
              <div>
                <strong>Order:</strong>{" "}
                {dispatchResult.order.order_number || "-"}
              </div>
              <div>
                <strong>Payment:</strong>{" "}
                {dispatchResult.order.payment_status || "-"}
              </div>
              <div>
                <strong>Quote ID:</strong>{" "}
                {dispatchResult.order.delivery_quote_id || "-"}
              </div>
              <div>
                <strong>Uber Delivery ID:</strong>{" "}
                {dispatchResult.order.delivery_external_id || "-"}
              </div>
              <div>
                <strong>Uber Status:</strong>{" "}
                {dispatchResult.order.delivery_status || "-"}
              </div>
              <div>
                <strong>Last Error:</strong>{" "}
                {dispatchResult.order.delivery_last_error || "-"}
              </div>

              {dispatchResult.order.delivery_tracking_url && (
                <div style={{ marginTop: 15 }}>
                  <a
                    href={dispatchResult.order.delivery_tracking_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Uber Tracking 열기
                  </a>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {finalResult && (
        <details style={{ marginTop: 25 }}>
          <summary>전체 응답 보기</summary>
          <pre
            style={{
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#f5f5f5",
              padding: 15,
            }}
          >
            {JSON.stringify(finalResult, null, 2)}
          </pre>
        </details>
      )}
    </main>
  );
}
