/* The four creatures from the reference image.
   Flat fills, thick #2B2B2B outlines, dot eyes. */

export type CreatureKind = "grey" | "orange" | "chick" | "dog";

const INK = "#2B2B2B";

/** Tall grey blob (screens 3, 5, 7). */
export function GreyBlob({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size * 1.28} viewBox="0 0 100 128" className={className} role="img" aria-label="Grey blob creature">
      {/* feet */}
      <ellipse cx="34" cy="120" rx="11" ry="6" fill="#9AA7B0" stroke={INK} strokeWidth="3.5" />
      <ellipse cx="66" cy="120" rx="11" ry="6" fill="#9AA7B0" stroke={INK} strokeWidth="3.5" />
      {/* tall body */}
      <path
        d="M50 6 C74 6 87 28 87 62 C87 96 71 114 50 114 C29 114 13 96 13 62 C13 28 26 6 50 6 Z"
        fill="#B0BEC5"
        stroke={INK}
        strokeWidth="4"
      />
      {/* arms */}
      <path d="M15 74 Q7 82 13 90" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M85 74 Q93 82 87 90" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      {/* dot eyes */}
      <circle cx="38" cy="52" r="5" fill={INK} />
      <circle cx="62" cy="52" r="5" fill={INK} />
      {/* smile */}
      <path d="M42 68 Q50 75 58 68" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/** Round orange blob (screens 3, 4, 5). */
export function OrangeBlob({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 112" className={className} role="img" aria-label="Orange blob creature">
      {/* body */}
      <ellipse cx="60" cy="60" rx="46" ry="40" fill="#FF9800" stroke={INK} strokeWidth="4" />
      {/* head nub */}
      <path d="M50 24 Q52 12 60 18 Q68 12 70 24" fill="#FF9800" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      {/* dot eyes */}
      <circle cx="44" cy="54" r="5.5" fill={INK} />
      <circle cx="76" cy="54" r="5.5" fill={INK} />
      {/* smile */}
      <path d="M48 70 Q60 80 72 70" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      {/* stubby arms */}
      <path d="M16 62 Q8 66 12 74" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M104 62 Q112 66 108 74" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/** Yellow chick (screens 3, 5, 7). */
export function YellowChick({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 112" className={className} role="img" aria-label="Yellow chick creature">
      {/* wings behind */}
      <ellipse cx="20" cy="66" rx="10" ry="17" fill="#FFEB3B" stroke={INK} strokeWidth="3.5" transform="rotate(-18 20 66)" />
      <ellipse cx="100" cy="66" rx="10" ry="17" fill="#FFEB3B" stroke={INK} strokeWidth="3.5" transform="rotate(18 100 66)" />
      {/* body */}
      <ellipse cx="60" cy="60" rx="42" ry="38" fill="#FFEB3B" stroke={INK} strokeWidth="4" />
      {/* head tuft */}
      <path d="M54 24 Q56 12 62 20 Q68 12 68 24" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      {/* dot eyes */}
      <circle cx="44" cy="50" r="5" fill={INK} />
      <circle cx="76" cy="50" r="5" fill={INK} />
      {/* beak */}
      <path d="M52 60 L68 60 L60 71 Z" fill="#FF9800" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {/* feet */}
      <path d="M48 96 l-4 6 M52 96 l0 7 M68 96 l0 7 M72 96 l4 6" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** White spotted dog (screens 2, 3, 5, 7). */
export function SpottedDog({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size * 0.92} viewBox="0 0 132 120" className={className} role="img" aria-label="Spotted dog creature">
      {/* floppy ears behind */}
      <ellipse cx="24" cy="46" rx="12" ry="20" fill="#FFFFFF" stroke={INK} strokeWidth="3.5" transform="rotate(-18 24 46)" />
      <ellipse cx="108" cy="46" rx="12" ry="20" fill="#FFFFFF" stroke={INK} strokeWidth="3.5" transform="rotate(18 108 46)" />
      {/* body */}
      <ellipse cx="66" cy="64" rx="44" ry="38" fill="#FFFFFF" stroke={INK} strokeWidth="4" />
      {/* spots */}
      <circle cx="44" cy="50" r="9" fill={INK} />
      <circle cx="90" cy="74" r="11" fill={INK} />
      <circle cx="72" cy="40" r="5.5" fill={INK} />
      <circle cx="34" cy="80" r="4.5" fill={INK} />
      {/* dot eyes */}
      <circle cx="54" cy="60" r="5" fill={INK} />
      <circle cx="80" cy="60" r="5" fill={INK} />
      {/* nose + mouth */}
      <ellipse cx="67" cy="74" rx="7" ry="5.5" fill={INK} />
      <path d="M67 79 Q67 86 60 88 M67 79 Q67 86 74 88" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const MAP: Record<CreatureKind, (p: { size?: number; className?: string }) => JSX.Element> = {
  grey: GreyBlob,
  orange: OrangeBlob,
  chick: YellowChick,
  dog: SpottedDog,
};

export default function Creature({
  kind,
  size = 96,
  className,
}: {
  kind: CreatureKind;
  size?: number;
  className?: string;
}) {
  const C = MAP[kind];
  return <C size={size} className={className} />;
}
