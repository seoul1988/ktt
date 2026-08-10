"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  pdfUrl: string;
  title: string;
};

type PdfJsLib = {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (source: { url: string }) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getViewport: (args: { scale: number }) => {
          width: number;
          height: number;
        };
        render: (args: {
          canvasContext: CanvasRenderingContext2D;
          viewport: {
            width: number;
            height: number;
          };
        }) => {
          promise: Promise<void>;
        };
      }>;
    }>;
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

  // PDF.js v4는 ES module이라 script 태그보다 dynamic import를 사용합니다.
  const pdfjs = (await import(
    /* webpackIgnore: true */
    PDFJS_SCRIPT
  )) as unknown as PdfJsLib;

  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  window.pdfjsLib = pdfjs;

  return pdfjs;
}

export default function CommunityPdfPreview({
  pdfUrl,
  title,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("PDF를 불러오는 중...");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    async function renderPdf() {
      const host = hostRef.current;
      if (!host || !pdfUrl) return;

      try {
        setError("");
        setStatus("PDF를 불러오는 중...");
        host.innerHTML = "";

        const pdfjs = await loadPdfJs();
        const pdf = await pdfjs.getDocument({ url: pdfUrl }).promise;

        if (cancelled) return;

        const availableWidth = Math.max(
          280,
          Math.min(host.clientWidth || window.innerWidth - 32, 900),
        );

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return;

          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });

          const cssScale = availableWidth / baseViewport.width;
          const renderScale = Math.min(
            2.2,
            Math.max(1.2, cssScale * window.devicePixelRatio),
          );

          const renderViewport = page.getViewport({
            scale: renderScale,
          });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

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
          pageWrap.style.padding = pageNumber === 1 ? "0" : "12px 0 0";
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
        void renderPdf();
      }, 250);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);

      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [pdfUrl]);

  return (
    <div
      className="w-full bg-[#ECE8E2] p-2 sm:p-3"
      aria-label={`${title} PDF preview`}
    >
      {status ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-[16px] bg-white px-4 text-center text-sm font-black text-[#6B6257]">
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