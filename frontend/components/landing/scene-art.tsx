import { motion, type MotionValue } from "motion/react";

/*
 * The landing story's illustration. Every layer shares one 1600×900 coordinate space, drawn
 * with the ground at y=720 and the action kept between x≈630 and x≈970 so a 320px phone
 * (which sees only the middle of a sliced viewBox) still sees the whole scene.
 */

export const VIEW = { width: 1600, height: 900, ground: 720 } as const;

const C = {
  oat: "var(--color-oat)",
  paper: "var(--color-paper)",
  ink: "var(--color-ink)",
  line: "var(--color-line)",
  moss: "var(--color-moss)",
  mossDeep: "var(--color-moss-deep)",
  mossTint: "var(--color-moss-tint)",
  night: "var(--color-night)",
  nightTint: "var(--color-night-tint)",
  sun: "var(--color-sun)",
  skin: "var(--color-skin)",
} as const;

type Fade = MotionValue<number> | number;

/** One full-stage SVG layer. `slice` fills any screen shape, cropping the sides on phones. */
export function Layer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      preserveAspectRatio="xMidYMax slice"
      className={`absolute inset-0 size-full ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/* ---------- The character ---------- */

const limb = { strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;

function Head({ x, y, asleep = false }: { x: number; y: number; asleep?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={22} fill={C.skin} />
      <path d={`M${x - 22.5} ${y + 2} A22.5 22.5 0 0 1 ${x + 22.5} ${y + 2} C${x + 12} ${y - 10} ${x - 10} ${y - 12} ${x - 22.5} ${y + 2} Z`} fill={C.ink} />
      {asleep ? (
        <g stroke={C.ink} strokeWidth={2.5} {...limb}>
          <path d={`M${x - 12} ${y + 3} q4 3 8 0`} />
          <path d={`M${x + 4} ${y + 3} q4 3 8 0`} />
        </g>
      ) : (
        <g fill={C.ink}>
          <circle cx={x - 8} cy={y + 3} r={2.6} />
          <circle cx={x + 8} cy={y + 3} r={2.6} />
        </g>
      )}
    </g>
  );
}

/** Torso, neck and head, with the feet's origin at (x, y). */
function Upper({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 6} y={y - 162} width={12} height={14} fill={C.skin} />
      <rect x={x - 24} y={y - 152} width={48} height={76} rx={20} fill={C.moss} />
      <Head x={x} y={y - 178} />
    </g>
  );
}

function Arm({ d, hand }: { d: string; hand: [number, number] }) {
  return (
    <g>
      <path d={d} stroke={C.moss} strokeWidth={13} {...limb} />
      <circle cx={hand[0]} cy={hand[1]} r={6.5} fill={C.skin} />
    </g>
  );
}

function Legs({ x, y, stride = 0 }: { x: number; y: number; stride?: number }) {
  return (
    <g stroke={C.ink} strokeWidth={14} {...limb}>
      <path d={`M${x - 9} ${y - 82} L${x - 10 - stride} ${y - 7}`} />
      <path d={`M${x + 9} ${y - 82} L${x + 10 + stride} ${y - 7}`} />
    </g>
  );
}

function Cup({ x, y, fill = C.paper }: { x: number; y: number; fill?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={18} height={21} rx={4} fill={fill} stroke={C.ink} strokeWidth={2} />
      <path d={`M${x + 18} ${y + 5} h4 a4 4 0 0 1 0 9 h-4`} stroke={C.ink} strokeWidth={2} fill="none" />
    </g>
  );
}

/** Standing, setting the alarm on his phone. */
function StandPhone({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Legs x={x} y={y} />
      <Upper x={x} y={y} />
      <Arm d={`M${x - 27} ${y - 140} L${x - 31} ${y - 86}`} hand={[x - 31, y - 82]} />
      <Arm d={`M${x + 25} ${y - 140} L${x + 34} ${y - 108} L${x + 14} ${y - 124}`} hand={[x + 12, y - 125]} />
      <rect x={x + 2} y={y - 146} width={14} height={23} rx={3} fill={C.ink} />
      <rect x={x + 4.5} y={y - 143} width={9} height={15} rx={1.5} fill={C.sun} />
    </g>
  );
}

function StandMug({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Legs x={x} y={y} />
      <Upper x={x} y={y} />
      <Arm d={`M${x - 27} ${y - 140} L${x - 31} ${y - 86}`} hand={[x - 31, y - 82]} />
      <Arm d={`M${x + 25} ${y - 140} L${x + 33} ${y - 108} L${x + 12} ${y - 108}`} hand={[x + 10, y - 108]} />
      <Cup x={x - 6} y={y - 122} fill={C.night} />
    </g>
  );
}

/** Walking towards us. The two `step` fades swap which leg leads, so scrolling reads as steps. */
function Walker({ x, y, step, cup }: { x: number; y: number; step: [Fade, Fade]; cup: boolean }) {
  return (
    <g>
      <motion.g style={{ opacity: step[0] }}>
        <Legs x={x} y={y} stride={14} />
      </motion.g>
      <motion.g style={{ opacity: step[1] }}>
        <Legs x={x} y={y} stride={-6} />
      </motion.g>
      <Upper x={x} y={y} />
      <Arm d={`M${x - 27} ${y - 140} L${x - 36} ${y - 88}`} hand={[x - 37, y - 84]} />
      {cup ? (
        <>
          <Arm d={`M${x + 25} ${y - 140} L${x + 36} ${y - 108} L${x + 22} ${y - 96}`} hand={[x + 22, y - 96]} />
          <Cup x={x + 14} y={y - 112} />
        </>
      ) : (
        <Arm d={`M${x + 27} ${y - 140} L${x + 36} ${y - 88}`} hand={[x + 37, y - 84]} />
      )}
    </g>
  );
}

/** Upper body behind a table or desk, both hands forward. */
function Seated({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Upper x={x} y={y} />
      <Arm d={`M${x - 26} ${y - 140} L${x - 40} ${y - 100} L${x - 18} ${y - 84}`} hand={[x - 16, y - 84]} />
      <Arm d={`M${x + 26} ${y - 140} L${x + 40} ${y - 100} L${x + 18} ${y - 84}`} hand={[x + 16, y - 84]} />
    </g>
  );
}

/* ---------- Shared scenery ---------- */

export function Hills() {
  return (
    <g>
      <path d="M0 650 Q300 560 620 640 T1250 615 T1600 600 V900 H0 Z" fill={C.mossTint} />
      <rect x={0} y={VIEW.ground} width={VIEW.width} height={VIEW.height - VIEW.ground} fill={C.moss} />
    </g>
  );
}

const STARS: [number, number, number][] = [
  [90, 120, 2.5], [210, 260, 2], [330, 90, 3], [470, 210, 2], [560, 70, 2.5], [640, 300, 2],
  [720, 150, 3], [840, 60, 2], [910, 240, 2.5], [1010, 120, 2], [1110, 320, 2], [1190, 80, 3],
  [1290, 200, 2], [1380, 110, 2.5], [1480, 260, 2], [1540, 70, 2], [760, 380, 2], [1050, 400, 2.5],
];

export function Stars() {
  return (
    <g fill={C.paper}>
      {STARS.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)}
    </g>
  );
}

export function Moon({ cx, cy, r = 20 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={C.paper} />
      <circle cx={cx + r * 0.45} cy={cy - r * 0.3} r={r * 0.85} fill={C.night} />
    </g>
  );
}

export function Sun({ cx, cy, r = 26 }: { cx: number; cy: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill={C.sun} />;
}

/** Warm light around a lamp; drawn above the darkness layer so it reads as light. */
export function Glow({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g fill={C.sun}>
      <circle cx={cx} cy={cy} r={95} opacity={0.18} />
      <circle cx={cx} cy={cy} r={48} opacity={0.32} />
    </g>
  );
}

export const LAMPS = {
  bedside: { cx: 935, cy: 585 },
  pendant: { cx: 800, cy: 398 },
  street: { cx: 934, cy: 516 },
} as const;

/* ---------- Sets ---------- */

type BedroomPoses = { standPhone: Fade; phoneDown: Fade; lie: Fade; sitUp: Fade; standMug: Fade };

export function Bedroom({ poses }: { poses: BedroomPoses }) {
  const g = VIEW.ground;
  return (
    <g>
      {/* bed */}
      <rect x={616} y={588} width={24} height={132} rx={10} fill={C.night} />
      <rect x={630} y={640} width={262} height={62} rx={14} fill={C.paper} />
      <rect x={640} y={g - 20} width={12} height={20} fill={C.ink} />
      <rect x={872} y={g - 20} width={12} height={20} fill={C.ink} />
      <rect x={648} y={616} width={64} height={26} rx={13} fill={C.paper} stroke={C.line} strokeWidth={2} />
      {/* nightstand and lamp */}
      <rect x={902} y={652} width={66} height={68} rx={8} fill={C.line} />
      <rect x={932} y={596} width={6} height={56} fill={C.ink} />
      <path d="M910 600 L960 600 L950 566 L920 566 Z" fill={C.sun} />
      <motion.g style={{ opacity: poses.phoneDown }}>
        <rect x={944} y={645} width={18} height={7} rx={2} fill={C.ink} />
      </motion.g>

      <motion.g style={{ opacity: poses.lie }}>
        <Head x={680} y={624} asleep />
        <rect x={700} y={622} width={192} height={40} rx={16} fill={C.nightTint} />
      </motion.g>
      <motion.g style={{ opacity: poses.sitUp }}>
        <rect x={666} y={566} width={48} height={74} rx={20} fill={C.moss} />
        <Arm d="M668 576 L640 530 L652 496" hand={[652, 492]} />
        <Arm d="M712 576 L740 530 L728 496" hand={[728, 492]} />
        <rect x={684} y={552} width={12} height={14} fill={C.skin} />
        <Head x={690} y={538} />
        <rect x={650} y={622} width={242} height={40} rx={16} fill={C.nightTint} />
      </motion.g>
      <motion.g style={{ opacity: poses.standPhone }}>
        <rect x={700} y={622} width={192} height={40} rx={16} fill={C.nightTint} />
        <StandPhone x={850} y={g} />
      </motion.g>
      <motion.g style={{ opacity: poses.standMug }}>
        <rect x={700} y={622} width={192} height={40} rx={16} fill={C.nightTint} opacity={0.9} />
        <StandMug x={845} y={g} />
      </motion.g>
    </g>
  );
}

export function Office() {
  const g = VIEW.ground;
  return (
    <g>
      <rect x={772} y={540} width={88} height={84} rx={16} fill={C.night} />
      <Seated x={816} y={g - 20} />
      <rect x={640} y={624} width={330} height={16} rx={6} fill={C.ink} />
      <rect x={656} y={640} width={12} height={g - 640} fill={C.ink} />
      <rect x={942} y={640} width={12} height={g - 640} fill={C.ink} />
      <rect x={706} y={570} width={92} height={56} rx={6} fill={C.line} />
      <circle cx={752} cy={598} r={5} fill={C.paper} />
      <rect x={884} y={596} width={36} height={28} rx={6} fill={C.paper} />
      <ellipse cx={894} cy={582} rx={10} ry={20} fill={C.moss} transform="rotate(-18 894 582)" />
      <ellipse cx={910} cy={578} rx={10} ry={22} fill={C.mossDeep} transform="rotate(16 910 578)" />
      <Cup x={660} y={603} fill={C.night} />
    </g>
  );
}

export function Street({ walkerX, step, evening, night }: { walkerX: Fade; step: [Fade, Fade]; evening: Fade; night: Fade }) {
  const g = VIEW.ground;
  return (
    <g>
      <rect x={0} y={g} width={VIEW.width} height={14} fill={C.line} />
      <rect x={652} y={588} width={14} height={g - 588} fill={C.ink} />
      <circle cx={659} cy={566} r={56} fill={C.mossDeep} />
      <rect x={1040} y={600} width={14} height={g - 600} fill={C.ink} />
      <circle cx={1047} cy={580} r={50} fill={C.mossDeep} />
      <rect x={930} y={520} width={8} height={g - 520} fill={C.ink} />
      <rect x={916} y={506} width={36} height={18} rx={6} fill={C.paper} />
      <motion.g style={{ x: walkerX }}>
        <motion.g style={{ opacity: evening }}>
          <Walker x={800} y={g} step={step} cup />
        </motion.g>
        <motion.g style={{ opacity: night }}>
          <Walker x={800} y={g} step={step} cup={false} />
        </motion.g>
      </motion.g>
    </g>
  );
}

export function Dinner() {
  const g = VIEW.ground;
  return (
    <g>
      <rect x={799} y={250} width={2} height={135} fill={C.ink} />
      <path d="M776 412 L824 412 L814 382 L786 382 Z" fill={C.sun} />
      <rect x={760} y={560} width={80} height={80} rx={16} fill={C.night} />
      <Seated x={800} y={g - 4} />
      <rect x={640} y={640} width={320} height={14} rx={6} fill={C.paper} />
      <rect x={662} y={654} width={12} height={g - 654} fill={C.ink} />
      <rect x={926} y={654} width={12} height={g - 654} fill={C.ink} />
      <ellipse cx={800} cy={638} rx={44} ry={7} fill={C.paper} stroke={C.line} strokeWidth={2} />
      <path d="M780 636 a20 14 0 0 0 40 0 Z" fill={C.mossTint} stroke={C.line} strokeWidth={2} />
      <rect x={880} y={608} width={18} height={30} rx={3} fill={C.nightTint} stroke={C.line} strokeWidth={2} />
    </g>
  );
}

/* ---------- Still illustrations for reduced motion ---------- */

type StillKind = "night" | "morning" | "noon" | "evening" | "nightAgain";

const STILL_LABEL: Record<StillKind, string> = {
  night: "Illustration: at night he sets his alarm, switches off the lamp and goes to sleep.",
  morning: "Illustration: at sunrise he sits up in bed and stretches.",
  noon: "Illustration: at noon he works at his desk in the office, the sun high overhead.",
  evening: "Illustration: in the low golden evening light he walks home with a coffee.",
  nightAgain: "Illustration: at night he eats dinner under a warm lamp.",
};

/** One scene, frozen at its key moment, cropped to the action. */
export function SceneStill({ kind }: { kind: StillKind }) {
  const dark = kind === "night" || kind === "nightAgain";
  const warm = kind === "morning" ? 0.5 : kind === "noon" ? 0.1 : kind === "evening" ? 0.6 : 0;
  const shade = kind === "night" ? 0.55 : kind === "nightAgain" ? 0.3 : kind === "evening" ? 0.08 : 0;
  return (
    <svg viewBox="560 370 480 360" role="img" aria-label={STILL_LABEL[kind]} className="block h-auto w-full">
      <rect x={0} y={0} width={VIEW.width} height={VIEW.height} fill={dark ? C.night : C.oat} />
      {warm > 0 && <rect x={0} y={0} width={VIEW.width} height={VIEW.height} fill={C.sun} opacity={warm} />}
      {kind === "morning" && <Sun cx={632} cy={600} r={30} />}
      {kind === "noon" && <Sun cx={800} cy={470} r={24} />}
      {kind === "evening" && <Sun cx={990} cy={612} r={30} />}
      <Hills />
      {kind === "night" && <Bedroom poses={{ standPhone: 0, phoneDown: 1, lie: 1, sitUp: 0, standMug: 0 }} />}
      {kind === "morning" && <Bedroom poses={{ standPhone: 0, phoneDown: 1, lie: 0, sitUp: 1, standMug: 0 }} />}
      {kind === "noon" && <Office />}
      {kind === "evening" && <Street walkerX={0} step={[1, 0]} evening={1} night={0} />}
      {kind === "nightAgain" && <Dinner />}
      {shade > 0 && <rect x={0} y={0} width={VIEW.width} height={VIEW.height} fill={C.night} opacity={shade} />}
      {dark && <Stars />}
      {kind === "night" && <Moon cx={990} cy={470} r={16} />}
      {kind === "nightAgain" && <><Moon cx={620} cy={470} r={16} /><Glow {...LAMPS.pendant} /></>}
    </svg>
  );
}

export type { StillKind };
