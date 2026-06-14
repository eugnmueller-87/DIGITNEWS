/** The Aushang/DIGITNEWS sun mark — a friendly spinning sun (from the design). */
export function SunLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
      style={{ animation: "sunSpin 40s linear infinite" }}
    >
      <g stroke="#34302A" strokeWidth="4" strokeLinecap="round">
        <line x1="50" y1="2" x2="50" y2="16" />
        <line x1="50" y1="84" x2="50" y2="98" />
        <line x1="2" y1="50" x2="16" y2="50" />
        <line x1="84" y1="50" x2="98" y2="50" />
        <line x1="16" y1="16" x2="26" y2="26" />
        <line x1="74" y1="74" x2="84" y2="84" />
        <line x1="84" y1="16" x2="74" y2="26" />
        <line x1="26" y1="74" x2="16" y2="84" />
      </g>
      <circle
        cx="50"
        cy="50"
        r="28"
        fill="#F9B233"
        stroke="#34302A"
        strokeWidth="4"
      />
      <circle cx="42" cy="46" r="3.5" fill="#34302A" />
      <circle cx="58" cy="46" r="3.5" fill="#34302A" />
      <path
        d="M41 57 Q50 65 59 57"
        fill="none"
        stroke="#34302A"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
