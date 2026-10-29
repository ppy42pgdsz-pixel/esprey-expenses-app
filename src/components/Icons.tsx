// Esprey Expenses icon set (redesign, Oct 2026).
// Line icons on a 24×24 grid, 1.8px strokes, drawn in currentColor so they
// take the colour of the text around them. These replace the emoji the app
// used to lean on — emoji render differently on iPhone and Android, and
// can't be coloured. Keep the set small; add an icon only when a screen
// needs it.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number; title?: string };

function Svg({ size, title, children, className, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={className ?? "icon"}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** Back chevron (replaces "←"). */
export const IconBack = (p: IconProps) => (
  <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>
);
/** Forward arrow (replaces "→"). */
export const IconForward = (p: IconProps) => (
  <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);
/** Settings cog (replaces "⚙"). */
export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
);
/** Document / report (replaces "📄"). */
export const IconDocument = (p: IconProps) => (
  <Svg {...p}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></Svg>
);
/** Help (replaces "?"). */
export const IconHelp = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.4M12 17.2v.1" /></Svg>
);
/** Camera (Capture). */
export const IconCamera = (p: IconProps) => (
  <Svg {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></Svg>
);
/** Pencil (manual entry, replaces "✏️"). */
export const IconPencil = (p: IconProps) => (
  <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /></Svg>
);
/** Envelope (emailed receipt, replaces "✉️" / "📧"). */
export const IconMail = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></Svg>
);
/** Receipt (photo receipt placeholder). */
export const IconReceipt = (p: IconProps) => (
  <Svg {...p}><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z" /><path d="M9 8h6M9 12h6M11 16h4" /></Svg>
);
/** PDF / file (replaces "📄" on Capture). */
export const IconFile = (p: IconProps) => (
  <Svg {...p}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></Svg>
);
/** Image (replaces "🖼️"). */
export const IconImage = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="M21 16l-5-5-7 7" /></Svg>
);
/** Warning triangle (replaces "⚠"). */
export const IconWarning = (p: IconProps) => (
  <Svg {...p}><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.1" /></Svg>
);
/** Tick in a circle (replaces "✅"). */
export const IconCheck = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></Svg>
);
/** Plain tick. */
export const IconTick = (p: IconProps) => (
  <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
);
/** Cross (replaces "✕"). */
export const IconClose = (p: IconProps) => (
  <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
);
/** Sparkles (Smart AI, replaces "✨"). */
export const IconSparkle = (p: IconProps) => (
  <Svg {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></Svg>
);
/** Star (favourite person, replaces "★"). */
export const IconStar = (p: IconProps) => (
  <Svg {...p}><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z" /></Svg>
);
/** Offline / no signal (replaces "📡"). */
export const IconOffline = (p: IconProps) => (
  <Svg {...p}><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0" /><path d="M12 19.5v.1" /><path d="M3 3l18 18" /></Svg>
);
/** Rotate (replaces "🔄"). */
export const IconRotate = (p: IconProps) => (
  <Svg {...p}><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v4h-4" /></Svg>
);
/** Calendar (replaces "📅"). */
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>
);
/** Chevron down (dropdowns). */
export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
);
/** Filter lines. */
export const IconFilter = (p: IconProps) => (
  <Svg {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Svg>
);
/** Refresh. */
export const IconRefresh = (p: IconProps) => (
  <Svg {...p}><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v4h-4" /></Svg>
);
/** Trash. */
export const IconTrash = (p: IconProps) => (
  <Svg {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" /><path d="M10 11v6M14 11v6" /></Svg>
);
/** Rocket (tour, replaces "🚀"). */
export const IconTour = (p: IconProps) => (
  <Svg {...p}><path d="M12 3c3 2 5 6 5 10l-2 2H9l-2-2c0-4 2-8 5-10z" /><path d="M9 13l-3 3 1 3 3-2M15 13l3 3-1 3-3-2" /><circle cx="12" cy="9" r="1.5" /></Svg>
);
/** Reply arrow (alias row, replaces "↳"). */
export const IconSub = (p: IconProps) => (
  <Svg {...p}><path d="M6 4v8a2 2 0 0 0 2 2h10" /><path d="M14 10l4 4-4 4" /></Svg>
);

/** Plus. */
export const IconPlus = (p: IconProps) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);

/** Esprey Expenses mark: yellow tile with the stack of receipts. */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size} className={className} role="img" aria-label="Esprey Expenses">
      <rect width="1024" height="1024" rx="224" fill="#F5B700" />
      <rect x="388" y="196" width="408" height="488" rx="48" fill="none" stroke="#1B1B1F" strokeWidth="64" />
      <rect x="228" y="324" width="448" height="516" rx="48" fill="#1B1B1F" />
      <rect x="308" y="404" width="80" height="272" fill="#F5B700" />
      <rect x="308" y="404" width="288" height="72" fill="#F5B700" />
      <rect x="308" y="508" width="220" height="72" fill="#F5B700" />
      <rect x="308" y="612" width="288" height="64" fill="#F5B700" />
      <rect x="308" y="716" width="288" height="64" fill="#F5B700" />
    </svg>
  );
}
