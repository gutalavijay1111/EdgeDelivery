import { useEffect, useLayoutEffect, useRef, useState } from "react";

const STORAGE_KEY = "edge_tutorial_done";

interface Step {
  target: string;         // data-tutorial attribute value
  title: string;
  body: string;
  arrowFrom: "bottom" | "top" | "left" | "right"; // which side of the tooltip arrow leaves from
}

const STEPS: Step[] = [
  {
    target: "explore",
    title: "Browse the CDN Gallery",
    body: "Explore AI-generated movie posters delivered via AWS CloudFront from 4 countries. Each card shows real live latency numbers — CDN first-fetch vs browser cache read.",
    arrowFrom: "bottom",
  },
  {
    target: "upload",
    title: "Generate Your Poster",
    body: "Upload any image, paste a URL, or grab a random Unsplash photo. AI turns it into a Netflix-style poster and serves it globally via CloudFront in seconds.",
    arrowFrom: "bottom",
  },
  {
    target: "cdn-metric",
    title: "Live CDN vs Cache Metrics",
    body: "Orange = first-fetch latency from the CloudFront edge node. Green = subsequent read from your browser cache. These are real measurements, not mocked.",
    arrowFrom: "top",
  },
];

interface Rect { top: number; left: number; width: number; height: number }

function getTargetRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tutorial="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/* Animated hand-drawn SVG arrow from tooltip to target element */
function DrawnArrow({
  tipX, tipY, tailX, tailY,
}: { tipX: number; tipY: number; tailX: number; tailY: number }) {
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  const [drawn, setDrawn] = useState(false);

  // Quadratic bezier with a slight organic curve
  const cpX = tailX + (tipX - tailX) * 0.4 + 40;
  const cpY = tailY + (tipY - tailY) * 0.2 - 30;
  const d = `M ${tailX} ${tailY} Q ${cpX} ${cpY} ${tipX} ${tipY}`;

  useLayoutEffect(() => {
    if (pathRef.current) {
      setLen(pathRef.current.getTotalLength());
    }
    setDrawn(false);
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(t);
  }, [tipX, tipY, tailX, tailY]);

  const arrowId = `ah-${Math.abs(tipX | 0)}-${Math.abs(tipY | 0)}`;

  return (
    <svg
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 10001 }}
      aria-hidden
    >
      <defs>
        {/* Slightly rough/organic filter for hand-drawn feel */}
        <filter id="rough-filter" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <marker id={arrowId} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M 0 0 L 8 3 L 0 6 Z" fill="#dda15e" />
        </marker>
      </defs>
      <path
        ref={pathRef}
        d={d}
        stroke="#dda15e"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        markerEnd={`url(#${arrowId})`}
        filter="url(#rough-filter)"
        strokeDasharray={len || 300}
        strokeDashoffset={drawn ? 0 : len || 300}
        style={{
          transition: drawn ? "stroke-dashoffset 0.55s cubic-bezier(0.4,0,0.2,1)" : "none",
        }}
      />
      {/* Small looping curl near the tail for the "hand-drawn" aesthetic */}
      <circle
        cx={tailX}
        cy={tailY}
        r="3.5"
        fill="#dda15e"
        opacity={drawn ? 1 : 0}
        style={{ transition: "opacity 0.3s 0.5s" }}
      />
    </svg>
  );
}

/* Spotlight mask: dim everything except a rect around the target */
function Spotlight({ rect, padding = 8 }: { rect: Rect; padding?: number }) {
  const x = rect.left - padding;
  const y = rect.top - padding;
  const w = rect.width + padding * 2;
  const h = rect.height + padding * 2;
  const r = 8;

  return (
    <svg
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999 }}
      aria-hidden
    >
      <defs>
        <mask id="spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={r} fill="black" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.72)"
        mask="url(#spotlight-mask)"
        style={{ transition: "all 0.3s ease" }}
      />
      {/* Glowing ring around target */}
      <rect
        x={x} y={y} width={w} height={h} rx={r}
        fill="none"
        stroke="#dda15e"
        strokeWidth="1.5"
        opacity="0.7"
        style={{ filter: "drop-shadow(0 0 6px rgba(221,161,94,0.8))" }}
      />
    </svg>
  );
}

/* Tooltip bubble */
function TooltipBubble({
  step, index, total, rect, arrowFrom, onNext, onSkip,
}: {
  step: Step; index: number; total: number;
  rect: Rect | null; arrowFrom: "bottom" | "top" | "left" | "right";
  onNext: () => void; onSkip: () => void;
}) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleRect, setBubbleRect] = useState<DOMRect | null>(null);

  // Measure once per step change (after paint) so the arrow knows where the bubble is.
  // useLayoutEffect without deps caused an infinite loop: setState → re-render → effect → setState …
  useEffect(() => {
    setBubbleRect(null);
    const id = requestAnimationFrame(() => {
      if (bubbleRef.current) setBubbleRect(bubbleRef.current.getBoundingClientRect());
    });
    return () => cancelAnimationFrame(id);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  // Position the bubble: try to place it near the target but within viewport
  let bubbleStyle: React.CSSProperties = { position: "fixed", zIndex: 10000 };

  if (rect) {
    const pad = 16;
    if (arrowFrom === "bottom") {
      // Tooltip below the target
      bubbleStyle = {
        ...bubbleStyle,
        top: rect.top + rect.height + 20,
        left: Math.max(pad, Math.min(rect.left + rect.width / 2 - 160, window.innerWidth - 340)),
      };
    } else if (arrowFrom === "top") {
      // Tooltip above the target
      const h = bubbleRef.current?.offsetHeight ?? 160;
      bubbleStyle = {
        ...bubbleStyle,
        top: Math.max(pad, rect.top - h - 20),
        left: Math.max(pad, Math.min(rect.left + rect.width / 2 - 160, window.innerWidth - 340)),
      };
    }
  } else {
    // Centered fallback
    bubbleStyle = {
      ...bubbleStyle,
      top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  // Arrow tail position (center of the tooltip bubble bottom or top edge)
  const tailX = bubbleRect ? bubbleRect.left + bubbleRect.width / 2 : 0;
  const tailY = arrowFrom === "bottom"
    ? (bubbleRect ? bubbleRect.top : 0)
    : (bubbleRect ? bubbleRect.bottom : 0);

  // Arrow tip: center of target element
  const tipX = rect ? rect.left + rect.width / 2 : 0;
  const tipY = arrowFrom === "bottom"
    ? (rect ? rect.top + rect.height / 2 : 0)
    : (rect ? rect.top + rect.height / 2 : 0);

  return (
    <>
      <div
        ref={bubbleRef}
        className="animate-fade-in"
        style={{
          ...bubbleStyle,
          width: 320,
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
          borderRadius: "12px",
          padding: "1.25rem 1.5rem",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        {/* Step indicator dots */}
        <div style={{ display: "flex", gap: "5px", marginBottom: "0.75rem" }}>
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 6, height: 6, borderRadius: "50%",
                backgroundColor: i === index ? "var(--amber)" : "var(--border)",
                transition: "background-color 0.2s",
              }}
            />
          ))}
        </div>

        <h3 style={{
          fontFamily: "Bebas Neue", fontSize: "1.3rem", color: "var(--text)",
          marginBottom: "0.5rem", letterSpacing: "0.03em",
        }}>
          {step.title}
        </h3>
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.55, marginBottom: "1.25rem" }}>
          {step.body}
        </p>

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={onSkip}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontSize: "0.78rem", padding: "0.25rem",
            }}
          >
            Skip tour
          </button>
          <button
            onClick={onNext}
            style={{
              backgroundColor: "var(--amber)", color: "#fff",
              border: "none", borderRadius: "6px",
              padding: "0.45rem 1.1rem", cursor: "pointer",
              fontFamily: "DM Sans", fontSize: "0.88rem", fontWeight: 600,
            }}
          >
            {index === total - 1 ? "Got it" : "Next →"}
          </button>
        </div>
      </div>

      {/* Draw the arrow only when we have both positions */}
      {rect && bubbleRect && tailX > 0 && tipX > 0 && (
        <DrawnArrow tailX={tailX} tailY={tailY} tipX={tipX} tipY={tipY} />
      )}
    </>
  );
}

export default function TutorialOverlay() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  // Show tutorial only on first visit
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Small delay so the page has rendered its elements
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  // Update target rect whenever step changes or on resize
  useLayoutEffect(() => {
    if (!visible) return;
    const update = () => setTargetRect(getTargetRect(STEPS[step].target));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [visible, step]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <>
      {/* Spotlight layer */}
      {targetRect ? (
        <Spotlight rect={targetRect} />
      ) : (
        // Full dim when no target found
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.72)",
          zIndex: 9999, pointerEvents: "none",
        }} />
      )}

      {/* Tooltip + arrow */}
      <TooltipBubble
        key={step}
        step={current}
        index={step}
        total={STEPS.length}
        rect={targetRect}
        arrowFrom={current.arrowFrom}
        onNext={next}
        onSkip={dismiss}
      />
    </>
  );
}
