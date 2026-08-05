"use client";

import { useEffect, useRef, useState } from "react";

type PdfFirstPagePreviewProps = {
  url: string;
  title?: string;
  className?: string;
};

export default function PdfFirstPagePreview({
  url,
  title = "PDF Preview",
  className = "",
}: PdfFirstPagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: any = null;

    async function renderPdf() {
      setLoading(true);
      setFailed(false);

      try {
        const pdfjs = await import("pdfjs-dist");

        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url,
          ).toString();
        }

        loadingTask = pdfjs.getDocument({
          url,
          withCredentials: false,
        });

        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const targetWidth = Math.max(
          canvas.parentElement?.clientWidth || 600,
          320,
        );
        const scale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Canvas context unavailable");
        }

        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        if (!cancelled) {
          setLoading(false);
        }
      } catch (error) {
        console.error("PDF preview error:", error);

        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    }

    void renderPdf();

    return () => {
      cancelled = true;

      try {
        loadingTask?.destroy?.();
      } catch {
        // Ignore cleanup failures.
      }
    };
  }, [url]);

  if (failed) {
    return (
      <div
        className={`flex min-h-56 items-center justify-center bg-[#EEF1F5] px-6 text-center ${className}`}
      >
        <div>
          <div className="text-5xl">📄</div>
          <p className="mt-3 text-sm font-black text-[#596273]">
            {title}
          </p>
          <p className="mt-1 text-xs font-semibold text-[#7A8493]">
            미리보기를 불러오지 못했습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#EEF1F5] ${className}`}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#EEF1F5] text-sm font-black text-[#596273]">
          PDF 불러오는 중...
        </div>
      )}

      <canvas
        ref={canvasRef}
        aria-label={title}
        className="block h-auto w-full"
      />
    </div>
  );
}
