"use client";

import { useEffect, useRef } from "react";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
};

export default function RichTextEditor({
  value,
  onChange,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor) return;

    if (editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
  }, [value]);

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function addLink() {
    const url = window.prompt("링크 주소를 입력하세요.", "https://");

    if (!url) return;

    runCommand("createLink", url);
  }

  function addImage() {
    const url = window.prompt("이미지 URL을 입력하세요.", "https://");

    if (!url) return;

    runCommand("insertImage", url);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const clipboardHtml = event.clipboardData.getData("text/html");
    const clipboardText = event.clipboardData.getData("text/plain");

    const looksLikeHtml =
      /<\/?[a-z][\s\S]*>/i.test(clipboardText) ||
      /&lt;\/?[a-z][\s\S]*&gt;/i.test(clipboardText);

    let htmlToInsert = clipboardHtml;

    /*
     * iPhone/Android에서는 복사한 HTML이 text/html 없이
     * text/plain으로만 전달되는 경우가 있습니다.
     */
    if (!htmlToInsert && looksLikeHtml) {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = clipboardText;
      htmlToInsert = textarea.value;
    }

    if (!htmlToInsert) {
      return;
    }

    event.preventDefault();

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const fragment = range.createContextualFragment(htmlToInsert);
    range.insertNode(fragment);

    selection.removeAllRanges();
    selection.addRange(range);

    requestAnimationFrame(() => {
      onChange(editorRef.current?.innerHTML ?? "");
    });
  }

  const toolButton =
    "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#172033] transition active:scale-95";

  return (
    <div className="overflow-hidden rounded-xl border border-gray-300 bg-white">
      <div className="flex flex-wrap gap-1.5 border-b border-gray-200 bg-gray-50 p-2">
        <button
          type="button"
          onClick={() => runCommand("bold")}
          className={toolButton}
        >
          굵게
        </button>

        <button
          type="button"
          onClick={() => runCommand("italic")}
          className={toolButton}
        >
          기울임
        </button>

        <button
          type="button"
          onClick={() => runCommand("underline")}
          className={toolButton}
        >
          밑줄
        </button>

        <button
          type="button"
          onClick={() => runCommand("formatBlock", "h2")}
          className={toolButton}
        >
          큰 제목
        </button>

        <button
          type="button"
          onClick={() => runCommand("formatBlock", "h3")}
          className={toolButton}
        >
          작은 제목
        </button>

        <button
          type="button"
          onClick={() => runCommand("insertUnorderedList")}
          className={toolButton}
        >
          목록
        </button>

        <button
          type="button"
          onClick={() => runCommand("insertOrderedList")}
          className={toolButton}
        >
          번호
        </button>

        <button
          type="button"
          onClick={addLink}
          className={toolButton}
        >
          링크
        </button>

        <button
          type="button"
          onClick={addImage}
          className={toolButton}
        >
          이미지
        </button>

        <button
          type="button"
          onClick={() => runCommand("removeFormat")}
          className={toolButton}
        >
          서식 제거
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(event) =>
          onChange((event.currentTarget as HTMLDivElement).innerHTML)
        }
        onPaste={handlePaste}
        className="
          min-h-[260px] px-3 py-3
          text-[14px] leading-7 text-[#172033]
          outline-none
          [&_a]:text-blue-600 [&_a]:underline
          [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-[22px] [&_h2]:font-bold
          [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-[18px] [&_h3]:font-semibold
          [&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl
          [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-3 [&_ul]:list-disc
        "
      />

      <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-[10px] leading-4 text-gray-500">
        웹페이지나 문서에서 복사한 내용을 그대로 붙여넣을 수 있습니다.
        이미지 파일 자체를 붙여넣는 방식은 지원하지 않으며 이미지 URL을 사용하세요.
      </div>
    </div>
  );
}