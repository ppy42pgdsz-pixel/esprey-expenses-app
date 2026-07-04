// First-login guided tour (#48a). Spotlights real Dashboard elements with
// step-by-step tooltips. Auto-starts once per user (profile tour_seen flag);
// relaunchable anytime from Help & FAQ via /?tour=1.

import { useLayoutEffect, useState } from "react";
import { t } from "../../shared/i18n";

export interface TourStep {
  selector: string; // matches a [data-tour=…] element on the Dashboard
  title: string;
  body: string;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export default function Tour({
  steps,
  onClose,
}: {
  steps: TourStep[];
  onClose: (completed: boolean) => void;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];

  useLayoutEffect(() => {
    function measure() {
      const el = document.querySelector(step.selector);
      if (el) {
        el.scrollIntoView({ block: "center" });
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null); // target missing (e.g. empty dashboard) — centered card
      }
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [i, step.selector]);

  const CARD_W = 300;
  const below = rect ? rect.bottom < window.innerHeight / 2 || rect.top < 170 : false;
  const cardStyle: React.CSSProperties = rect
    ? below
      ? { top: rect.bottom + 12, left: clamp(rect.left, 8, window.innerWidth - CARD_W - 8) }
      : { bottom: window.innerHeight - rect.top + 12, left: clamp(rect.left, 8, window.innerWidth - CARD_W - 8) }
    : { top: "38%", left: "50%", transform: "translateX(-50%)" };

  return (
    <div className={"tour-backdrop" + (rect ? "" : " dim")} onClick={() => onClose(false)}>
      {rect && (
        <div
          className="tour-spotlight"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      <div className="tour-card" style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div className="tour-title">{step.title}</div>
        <div className="tour-body">{step.body}</div>
        <div className="tour-dots">
          {steps.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}
        </div>
        <div className="tour-actions">
          <button type="button" className="ghost-btn small" onClick={() => onClose(false)}>
            {t("Skip")}
          </button>
          <span style={{ flex: 1 }} />
          {i > 0 && (
            <button type="button" className="ghost-btn small" onClick={() => setI(i - 1)}>
              {t("Back")}
            </button>
          )}
          {i < steps.length - 1 ? (
            <button type="button" className="primary-btn small" onClick={() => setI(i + 1)}>
              {t("Next")}
            </button>
          ) : (
            <button type="button" className="primary-btn small" onClick={() => onClose(true)}>
              {t("Got it!")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The Dashboard tour, built fresh each time so t() uses the current language. */
export function dashboardTourSteps(): TourStep[] {
  return [
    {
      selector: '[data-tour="capture"]',
      title: t("Add receipts"),
      body: t("Tap + Capture to photograph a receipt — the amount, vendor and date are read for you. You can also email receipts in, or add cash expenses manually."),
    },
    {
      selector: '[data-tour="pills"]',
      title: t("Your counters"),
      body: t("Receipts shows everything. Uncategorized still needs a company. Issues turns red when something needs your attention — tap it to see why."),
    },
    {
      selector: '[data-tour="reports"]',
      title: t("Monthly reports"),
      body: t("At month-end, generate a polished PDF of your expenses here — in the language of your choice."),
    },
    {
      selector: '[data-tour="smartai"]',
      title: t("Your assistant"),
      body: t("Ask anything — \"how much did I spend on meals?\" — or tell it to record an expense for you. It only ever sees your own receipts."),
    },
    {
      selector: '[data-tour="help"]',
      title: t("Need help?"),
      body: t("The ? opens the FAQ with an ask-a-question box. You can rerun this tour from there anytime."),
    },
  ];
}
