"use client";

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import DOMPurify from "dompurify";

interface MathJaxGlobal {
  typesetPromise?: (elements?: Element[]) => Promise<void>;
  typesetClear?: (elements?: Element[]) => void;
  startup?: {
    typeset?: boolean;
    promise?: Promise<void>;
  };
  tex?: Record<string, unknown>;
  loader?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

declare global {
  interface Window {
    MathJax?: MathJaxGlobal;
  }
}

let mathJaxLoadPromise: Promise<MathJaxGlobal> | null = null;
const MATHJAX_SOURCES = [
  "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js",
  "https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.min.js",
];

function loadMathJax(): Promise<MathJaxGlobal> {
  if (window.MathJax?.typesetPromise) return Promise.resolve(window.MathJax);
  if (mathJaxLoadPromise) return mathJaxLoadPromise;

  const createConfiguration = (): MathJaxGlobal => ({
    tex: {
      inlineMath: [["\\(", "\\)"], ["$", "$"]],
      displayMath: [["\\[", "\\]"], ["$$", "$$"]],
      packages: { "[+]": ["mhchem"] },
    },
    loader: { load: ["[tex]/mhchem"] },
    options: { skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"] },
    startup: { typeset: false },
  });

  const loadSource = (sourceIndex: number): Promise<MathJaxGlobal> => {
    window.MathJax = createConfiguration();

    return new Promise<MathJaxGlobal>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = MATHJAX_SOURCES[sourceIndex];
      script.async = true;

      const retryOrReject = (error: unknown) => {
        script.remove();
        if (sourceIndex + 1 < MATHJAX_SOURCES.length) {
          loadSource(sourceIndex + 1).then(resolve, reject);
        } else {
          reject(error);
        }
      };

      script.onload = () => {
        const mathJax = window.MathJax;
        if (!mathJax) {
          retryOrReject(new Error("MathJax loaded without initializing"));
          return;
        }

        (mathJax.startup?.promise ?? Promise.resolve())
          .then(() => {
            if (!mathJax.typesetPromise) {
              retryOrReject(new Error("MathJax typesetting is unavailable"));
              return;
            }
            resolve(mathJax);
          })
          .catch(retryOrReject);
      };
      script.onerror = () => retryOrReject(new Error(`Could not load MathJax from ${script.src}`));
      document.head.appendChild(script);
    });
  };

  mathJaxLoadPromise = loadSource(0).catch((error: unknown) => {
    mathJaxLoadPromise = null;
    throw error;
  });

  return mathJaxLoadPromise;
}

function MathContent({
  html,
  className = "",
  as = "div",
  naturalMode = true,
}: {
  html: string;
  className?: string;
  as?: "div" | "span";
  naturalMode?: boolean;
}) {
  const contentRef = useRef<HTMLElement | null>(null);
  const setContentRef = useCallback((element: HTMLElement | null) => {
    contentRef.current = element;
  }, []);
  const sanitizedHtml = useMemo(
    () => {
      let contentHtml = html;
      if (typeof document !== "undefined") {
        const template = document.createElement("template");
        template.innerHTML = html;
        template.content.querySelectorAll("img[data-src], source[data-src]").forEach((image) => {
          if (!image.hasAttribute("src") && !image.hasAttribute("srcset")) {
            image.setAttribute("src", image.getAttribute("data-src") || "");
          }
        });
        contentHtml = template.innerHTML;
      }

      return DOMPurify.sanitize(contentHtml, {
        FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "select", "textarea"],
        FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "onkeydown", "onkeyup", "onkeypress"],
        USE_PROFILES: { html: true, svg: true },
        ADD_ATTR: ["style", "src", "srcset", "alt", "sizes", "loading", "decoding", "data-src", "viewBox", "xmlns", "fill", "fill-rule", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "transform", "text-anchor", "dominant-baseline", "font-size", "font-weight", "marker-end", "marker-start", "markerWidth", "markerHeight", "refX", "refY", "orient", "color", "bgcolor", "background", "text", "link", "vlink", "alink", "bordercolor", "border", "cellpadding", "cellspacing", "align", "valign", "rowspan", "colspan", "width", "height", "hspace", "vspace", "frame", "rules", "nowrap", "face", "size"],
        ADD_DATA_URI_TAGS: ["img", "source"],
        FORCE_BODY: true,
      });
    },
    [html]
  );

  useEffect(() => {
    let cancelled = false;
    const content = contentRef.current;
    if (!content) return;

    loadMathJax()
      .then(async (mathJax) => {
        if (cancelled || !contentRef.current) return;
        await mathJax.typesetPromise?.([content]);
      })
      .catch((error: unknown) => {
        if (!cancelled) console.error("MathJax rendering failed:", error);
      });

    return () => {
      cancelled = true;
      window.MathJax?.typesetClear?.([content]);
    };
  }, [sanitizedHtml]);

  const contentProps = useMemo(
    () => ({
      className: `html-content ${naturalMode ? "natural-mode" : ""} ${className}`,
      dangerouslySetInnerHTML: { __html: sanitizedHtml },
    }),
    [className, sanitizedHtml, naturalMode]
  );

  return as === "span" ? (
    <span ref={setContentRef} {...contentProps} />
  ) : (
    <div ref={setContentRef} {...contentProps} />
  );
}

export default memo(MathContent);