"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  pdfUrl: string;
  title: string;
};

type PdfViewport = {
  width: number;
  height: number;
};

type PdfPage = {
  getViewport: (args: { scale: number }) => PdfViewport;
  render: (args: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }) => {
    promise: Promise<void>;
  };
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy?: () => Promise<void> | void;
};

type PdfJsLib = {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (source: { url: string }) => {
    promise: Promise<PdfDocument>;
  };
};

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
  }
}

const PDFJS_VERSION = "4.10.38";
const PDFJS_SCRIPT =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
const PDFJS_WORKER =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

async function loadPdfJs(): Promise<PdfJsLib> {
  if (window.pdfjsLib) {
    return window.pdfjsLib;
  }

  const pdfjs = (await import(
    /* webpackIgnore: true */
    PDFJS_SCRIPT
  )) as unknown as PdfJsLib;

  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  window.pdfjsLib = pdfjs;

  return pdfjs;
}

export default function BusinessPdfPreview({ pdfUrl, title }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("PDF를 불러오는 중...");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let currentPdf: PdfDocument | null = null;

    async function renderPdf() {
      const host = hostRef.current;
      if (!host || !pdfUrl) return;

      try {
        setError("");
        setStatus("PDF를 불러오는 중...");
        host.innerHTML = "";

        const pdfjs = await loadPdfJs();

        currentPdf = await pdfjs.getDocument({
          url: pdfUrl,
        }).promise;

        if (cancelled) return;

        const viewportWidth =
          typeof window !== "undefined" ? window.innerWidth : 360;

        const availableWidth = Math.max(
          280,
          Math.min(host.clientWidth || viewportWidth - 24, 900),
        );

        for (
          let pageNumber = 1;
          pageNumber <= currentPdf.numPages;
          pageNumber += 1
        ) {
          if (cancelled) return;

          const page = await currentPdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });

          const cssScale = availableWidth / baseViewport.width;

          // 휴대폰 Retina 화면에서도 글자가 흐리지 않도록 실제 canvas는
          // CSS 표시 크기보다 크게 렌더링합니다.
          const devicePixelRatio = Math.min(
            2,
            Math.max(1, window.devicePixelRatio || 1),
          );

          const renderScale = Math.min(
            2.5,
            Math.max(1.25, cssScale * devicePixelRatio),
          );

          const renderViewport = page.getViewport({
            scale: renderScale,
          });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", {
            alpha: false,
          });

          if (!context) {
            throw new Error("PDF canvas를 만들지 못했습니다.");
          }

          canvas.width = Math.ceil(renderViewport.width);
          canvas.height = Math.ceil(renderViewport.height);

          canvas.style.width = `${availableWidth}px`;
          canvas.style.height = "auto";
          canvas.style.display = "block";
          canvas.style.maxWidth = "100%";
          canvas.style.background = "#ffffff";
          canvas.style.borderRadius = "14px";
          canvas.style.boxShadow = "0 1px 3px rgba(15,23,42,.14)";

          const pageWrap = document.createElement("div");
          pageWrap.style.display = "flex";
          pageWrap.style.justifyContent = "center";
          pageWrap.style.width = "100%";
          pageWrap.style.padding =
            pageNumber === 1 ? "0" : "12px 0 0";

          pageWrap.appendChild(canvas);
          host.appendChild(pageWrap);

          await page.render({
            canvasContext: context,
            viewport: renderViewport,
          }).promise;
        }

        if (!cancelled) {
          setStatus("");
        }
      } catch (renderError) {
        console.error("PDF render error:", renderError);

        if (!cancelled) {
          setError(
            "PDF 미리보기를 만들지 못했습니다. 아래 원본 PDF 보기 버튼을 이용해 주세요.",
          );
          setStatus("");
        }
      }
    }

    void renderPdf();

    function handleResize() {
      if (resizeTimer) clearTimeout(resizeTimer);

      resizeTimer = setTimeout(() => {
        if (!cancelled) void renderPdf();
      }, 250);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);

      if (resizeTimer) clearTimeout(resizeTimer);

      try {
        void currentPdf?.destroy?.();
      } catch {
        // cleanup 실패는 화면 표시와 무관하므로 무시합니다.
      }
    };
  }, [pdfUrl]);

  return (
    <div
      className="w-full bg-[#ECE8E2] p-2 sm:p-3"
      aria-label={`${title} PDF preview`}
    >
      {status ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-[16px] bg-white px-5 text-center text-sm font-black text-[#6B6257]">
          {status}
        </div>
      ) : null}

      {error ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-[16px] bg-white px-5 text-center text-sm font-black leading-6 text-[#8A332A]">
          {error}
        </div>
      ) : null}

      <div
        ref={hostRef}
        className={status || error ? "hidden" : "w-full"}
      />
    </div>
  );
}