/* Soft cloud mascots for the new design language.
   Rounded cloud shapes with simple closed-eye / smiling faces, inline SVG.
   kind values are unchanged so existing imports keep working. */

export type CreatureKind = "grey" | "orange" | "chick" | "dog";

const INK = "#111111";

type CloudProps = { size?: number; className?: string };

/** Shared cloud body built from circles + a rounded base, no outlines. */
function CloudBody({ fill, sparkle }: { fill: string; sparkle?: boolean }) {
  return (
    <g>
      <circle cx="36" cy="60" r="20" fill={fill} />
      <circle cx="60" cy="46" r="24" fill={fill} />
      <circle cx="84" cy="60" r="19" fill={fill} />
      <rect x="28" y="52" width="68" height="30" rx="15" fill={fill} />
      {sparkle && (
        <g fill="#FFFFFF" opacity="0.85">
          <path d="M92 30 l2.2 5.6 5.6 2.2 -5.6 2.2 -2.2 5.6 -2.2 -5.6 -5.6 -2.2 5.6 -2.2 z" />
          <path d="M24 34 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" />
        </g>
      )}
    </g>
  );
}

/** Happy closed eyes (two arcs) + smile, drawn in ink. */
function HappyFace() {
  return (
    <g stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none">
      <path d="M44 62 q6 7 12 0" />
      <path d="M64 62 q6 7 12 0" />
      <path d="M52 74 q8 8 16 0" />
    </g>
  );
}

/** Dot eyes + smile. */
function DotFace() {
  return (
    <g>
      <circle cx="50" cy="60" r="4.5" fill={INK} />
      <circle cx="70" cy="60" r="4.5" fill={INK} />
      <path d="M52 72 q8 8 16 0" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** Soft grey cloud — calm, neutral. */
export function GreyBlob({ size = 96, className }: CloudProps) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 120 102" className={className} role="img" aria-label="Grey cloud creature">
      <CloudBody fill="#E4E7EC" />
      <HappyFace />
    </svg>
  );
}

/** Warm tangerine cloud — cheerful. */
export function OrangeBlob({ size = 96, className }: CloudProps) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 120 102" className={className} role="img" aria-label="Orange cloud creature">
      <CloudBody fill="#FFC98A" sparkle />
      <DotFace />
    </svg>
  );
}

/** Sun-yellow cloud — the hero mascot. */
export function YellowChick({ size = 96, className }: CloudProps) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 120 102" className={className} role="img" aria-label="Yellow cloud creature">
      <CloudBody fill="#FFD93D" sparkle />
      <HappyFace />
    </svg>
  );
}

/** Sky-blue cloud — friendly. */
export function SpottedDog({ size = 96, className }: CloudProps) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 120 102" className={className} role="img" aria-label="Blue cloud creature">
      <CloudBody fill="#BFE3FF" sparkle />
      <HappyFace />
    </svg>
  );
}

const MAP: Record<CreatureKind, (p: CloudProps) => JSX.Element> = {
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
