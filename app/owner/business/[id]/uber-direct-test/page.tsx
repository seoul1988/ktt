"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

export default function UberDirectTestPage() {
  const params = useParams();
  const businessId = String(params?.id || "");

  const [orderId, setOrderId] = useState("127");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function runUberTest() {
    if (!orderId.trim()) {
      alert("Order ID를 입력하세요.");
      return;
    }

    const confirmed = window.confirm(
      `Uber Direct 실제 배달을 생성합니다.\n\n` +
        `Business ID: ${businessId}\n` +
        `Order ID: ${orderId}\n\n` +
        `Square 결제는 하지 않습니다.\n` +
        `Uber 배달료가 발생할 수 있습니다.\n\n` +
        `계속하시겠습니까?`,
    );

    if (!confirmed) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        `/api/owner/business/${businessId}/uber-direct-test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId: Number(orderId),
          }),
        },
      );

      const data = await response.json().catch(() => ({
        ok: false,
        error: `Invalid server response (${response.status})`,
      }));

      setResult({
        httpStatus: response.status,
        ...data,
      });
    } catch (error) {
      setResult({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Network error",
      });
    } finally {
      setLoading(false);
    }
  }

  const success =
    result?.ok === true &&
    (result?.order?.delivery_external_id ||
      result?.uberResult?.deliveryId);

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
          background: "#fff3cd",
          border: "1px solid #ffe69c",
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <strong>TEST MODE</strong>
        <p style={{ marginBottom: 0 }}>
          Square 결제, Square 영수증, SMS는 실행하지 않습니다.
          <br />
          Uber Direct 실제 배달만 생성합니다.
          <br />
          실제 Uber 배달료가 발생할 수 있습니다.
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 6 }}>
          Business ID
        </div>

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
        <div style={{ marginBottom: 6 }}>
          Order ID
        </div>

        <input
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
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
        disabled={loading}
        onClick={runUberTest}
        style={{
          width: "100%",
          padding: "16px 20px",
          fontSize: 18,
          fontWeight: 700,
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading
          ? "UBER 호출 중..."
          : "UBER DIRECT만 호출"}
      </button>

      {result && (
        <section
          style={{
            marginTop: 30,
            padding: 20,
            border: `2px solid ${
              success ? "#198754" : "#dc3545"
            }`,
            borderRadius: 8,
          }}
        >
          <h2>
            {success
              ? "Uber Direct 생성 성공"
              : "Uber Direct 결과"}
          </h2>

          {result?.error && (
            <>
              <h3>ERROR</h3>

              <div
                style={{
                  padding: 12,
                  background: "#f8d7da",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {result.error}
              </div>
            </>
          )}

          {result?.order && (
            <div style={{ marginTop: 20 }}>
              <div>
                <strong>Order:</strong>{" "}
                {result.order.order_number}
              </div>

              <div>
                <strong>Payment:</strong>{" "}
                {result.order.payment_status || "-"}
              </div>

              <div>
                <strong>Quote ID:</strong>{" "}
                {result.order.delivery_quote_id || "-"}
              </div>

              <div>
                <strong>Uber Delivery ID:</strong>{" "}
                {result.order.delivery_external_id || "-"}
              </div>

              <div>
                <strong>Uber Status:</strong>{" "}
                {result.order.delivery_status || "-"}
              </div>

              <div>
                <strong>Last Error:</strong>{" "}
                {result.order.delivery_last_error || "-"}
              </div>

              {result.order.delivery_tracking_url && (
                <div style={{ marginTop: 15 }}>
                  <a
                    href={result.order.delivery_tracking_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Uber Tracking 열기
                  </a>
                </div>
              )}
            </div>
          )}

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
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </section>
      )}
    </main>
  );
}