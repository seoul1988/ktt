"use client";

type Props = {
  pdfUrl: string;
  title?: string;
};

export default function BusinessPdfPreview({
  pdfUrl,
  title = "Business Event PDF",
}: Props) {
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#ECE8E2]">
      <iframe
        src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
        title={title}
        className="h-full w-full border-0"
      />
    </div>
  );
}