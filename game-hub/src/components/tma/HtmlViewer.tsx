"use client";

import MathContent from "./MathContent";

export default function HtmlViewer({
  html,
  className = "",
  naturalMode = true,
  preserveDocument = false,
}: {
  html: string;
  className?: string;
  naturalMode?: boolean;
  preserveDocument?: boolean;
}) {
  if (preserveDocument) {
    return (
      <iframe
        srcDoc={html}
        title="Uploaded chapter notes"
        className={className || "w-full h-[75vh] min-h-[480px] border-0 bg-white"}
        sandbox="allow-scripts allow-forms allow-modals"
        referrerPolicy="no-referrer"
      />
    );
  }

  return <MathContent html={html} className={className} naturalMode={naturalMode} />;
}
