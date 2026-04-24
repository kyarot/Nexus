import { RefObject, useEffect, useMemo, useRef } from "react";

import { translateBatch } from "@/lib/translation-api";

const TEXT_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "span",
  "button",
  "label",
  "th",
  "td",
  "a",
  "li",
].join(",");

const shouldTranslate = (value: string) => {
  const text = value.trim();
  if (!text) return false;
  if (!/[A-Za-z]/.test(text)) return false;
  if (text.length < 2) return false;
  return true;
};

const getCandidateElements = (root: HTMLElement) => {
  const all = Array.from(root.querySelectorAll<HTMLElement>(TEXT_SELECTOR));
  return all.filter((element) => {
    if (element.closest("[data-no-translate='true']")) return false;
    if (element.children.length > 0) return false;

    const text = (element.textContent || "").trim();
    return shouldTranslate(text);
  });
};

export const useFieldworkerLiveTranslation = ({
  containerRef,
  apiBaseUrl,
  token,
  language,
  enabled = true,
  refreshKey,
}: {
  containerRef: RefObject<HTMLElement | null>;
  apiBaseUrl: string;
  token: string | null;
  language: string;
  enabled?: boolean;
  refreshKey?: string;
}) => {
  const inFlightRef = useRef(false);
  const applyingRef = useRef(false);
  const scheduleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedLanguage = useMemo(() => (language || "en").toLowerCase(), [language]);

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container || !token) return;

    let disposed = false;

    const restoreEnglish = () => {
      const nodes = container.querySelectorAll<HTMLElement>("[data-nx-original-text]");

      applyingRef.current = true;
      nodes.forEach((node) => {
        const original = node.dataset.nxOriginalText;
        if (original !== undefined && node.textContent !== original) {
          node.textContent = original;
        }
      });
      applyingRef.current = false;
    };

    const translateDom = async () => {
      if (inFlightRef.current || disposed) return;
      inFlightRef.current = true;

      try {
        const elements = getCandidateElements(container);
        if (!elements.length) return;

        const sourceTexts = elements.map((element) => {
          if (!element.dataset.nxOriginalText) {
            element.dataset.nxOriginalText = (element.textContent || "").trim();
          }
          return element.dataset.nxOriginalText || "";
        });

        if (normalizedLanguage === "en") {
          restoreEnglish();
          return;
        }

        const uniqueTexts = Array.from(new Set(sourceTexts.filter(shouldTranslate)));
        if (!uniqueTexts.length) return;

        const translatedUnique = await translateBatch(
          apiBaseUrl,
          token,
          uniqueTexts,
          normalizedLanguage,
          "en"
        );

        const translationMap = new Map<string, string>();
        uniqueTexts.forEach((source, index) => {
          translationMap.set(source, translatedUnique[index] || source);
        });

        applyingRef.current = true;
        elements.forEach((element) => {
          const source = element.dataset.nxOriginalText || "";
          if (!shouldTranslate(source)) return;

          const nextText = translationMap.get(source) || source;
          if (element.textContent !== nextText) {
            element.textContent = nextText;
          }
        });
        applyingRef.current = false;
      } catch (err) {
        console.error("Live translation failed:", err);
        applyingRef.current = false;
      } finally {
        inFlightRef.current = false;
      }
    };

    const scheduleTranslate = () => {
      if (scheduleTimerRef.current) {
        clearTimeout(scheduleTimerRef.current);
      }

      scheduleTimerRef.current = setTimeout(() => {
        void translateDom();
      }, 150);
    };

    const observer = new MutationObserver(() => {
      if (applyingRef.current) return;
      scheduleTranslate();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    void translateDom();

    return () => {
      disposed = true;
      if (scheduleTimerRef.current) {
        clearTimeout(scheduleTimerRef.current);
        scheduleTimerRef.current = null;
      }
      observer.disconnect();
    };
  }, [containerRef, apiBaseUrl, token, normalizedLanguage, enabled, refreshKey]);
};
