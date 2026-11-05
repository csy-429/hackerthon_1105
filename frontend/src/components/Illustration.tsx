export type IllustrationName =
  | "task"
  | "roster"
  | "review"
  | "request"
  | "confirm"
  | "profile"
  | "schedule"
  | "apply"
  | "inbox";

const G = "#2f6b3f";
const L = "#d7ead9";
const Y = "#f2b84b";

const ART: Record<IllustrationName, JSX.Element> = {
  task: (
    <>
      <rect x="18" y="10" width="44" height="58" rx="6" fill="#fff" stroke={G} strokeWidth="3" />
      <rect x="30" y="6" width="20" height="10" rx="4" fill={G} />
      <path d="M26 30h28M26 42h28M26 54h16" stroke={L} strokeWidth="4" strokeLinecap="round" />
      <circle cx="58" cy="58" r="12" fill={Y} />
      <path d="M58 52v12M52 58h12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  roster: (
    <>
      <circle cx="28" cy="28" r="9" fill={L} stroke={G} strokeWidth="3" />
      <circle cx="54" cy="28" r="9" fill={L} stroke={G} strokeWidth="3" />
      <path d="M12 62c0-10 7-16 16-16s16 6 16 16M38 62c0-10 7-16 16-16s14 6 14 16" fill="none" stroke={G} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  review: (
    <>
      <rect x="10" y="14" width="40" height="52" rx="5" fill="#fff" stroke={G} strokeWidth="3" />
      <path d="M18 28l4 4 8-8M18 44l4 4 8-8" stroke={G} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 30h8M36 46h8" stroke={L} strokeWidth="4" strokeLinecap="round" />
      <circle cx="56" cy="50" r="11" fill="#fff" stroke={Y} strokeWidth="4" />
      <path d="M64 58l8 8" stroke={Y} strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  request: (
    <>
      <rect x="10" y="22" width="60" height="38" rx="6" fill="#fff" stroke={G} strokeWidth="3" />
      <path d="M12 26l28 22 28-22" fill="none" stroke={G} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="62" cy="20" r="10" fill={Y} />
      <path d="M57 20l4 4 7-8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  confirm: (
    <>
      <circle cx="40" cy="40" r="28" fill={L} stroke={G} strokeWidth="3" />
      <path d="M26 41l10 10 20-22" stroke={G} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  profile: (
    <>
      <rect x="12" y="12" width="56" height="56" rx="8" fill="#fff" stroke={G} strokeWidth="3" />
      <circle cx="40" cy="34" r="10" fill={L} stroke={G} strokeWidth="3" />
      <path d="M22 60c2-10 10-14 18-14s16 4 18 14" fill="none" stroke={G} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  schedule: (
    <>
      <rect x="10" y="16" width="60" height="52" rx="6" fill="#fff" stroke={G} strokeWidth="3" />
      <path d="M10 30h60" stroke={G} strokeWidth="3" />
      <path d="M24 10v12M56 10v12" stroke={G} strokeWidth="4" strokeLinecap="round" />
      <rect x="20" y="38" width="16" height="10" rx="2" fill={Y} />
      <rect x="40" y="38" width="16" height="10" rx="2" fill={L} />
      <rect x="20" y="52" width="16" height="10" rx="2" fill={L} />
    </>
  ),
  apply: (
    <>
      <rect x="12" y="22" width="40" height="46" rx="5" fill="#fff" stroke={G} strokeWidth="3" />
      <path d="M20 36h24M20 48h16" stroke={L} strokeWidth="4" strokeLinecap="round" />
      <path d="M44 62l22-22 6 6-22 22-8 2z" fill={Y} stroke={G} strokeWidth="2.5" strokeLinejoin="round" />
    </>
  ),
  inbox: (
    <>
      <path d="M12 44l10-26h36l10 26v18H12z" fill="#fff" stroke={G} strokeWidth="3" strokeLinejoin="round" />
      <path d="M12 44h18l4 8h12l4-8h18" fill="none" stroke={G} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="58" cy="16" r="9" fill={Y} />
      <path d="M54 16l3 3 5-6" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

export function Illustration({ name }: { name: IllustrationName }) {
  return (
    <svg className="illust" viewBox="0 0 80 80" role="img" aria-hidden="true" focusable="false">
      {ART[name]}
    </svg>
  );
}
