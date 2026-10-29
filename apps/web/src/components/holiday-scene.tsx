/**
 * Decorative backdrops for the home hero, chosen by the upcoming holiday.
 * Every scene shares a horseshoe arch on top of the zellige texture; the hero's gradient
 * comes from `data-scene` (see globals.css), always dark enough for white text.
 * Pure SVG, aria-hidden, mirrored in RTL. Only the lanterns move, and only when motion is OK.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Scene = "crescent" | "desert" | "amazigh" | "national" | "zellige";

const SCENES: Record<string, Scene> = {
  "islamic-new-year": "crescent",
  mawlid: "crescent",
  "eid-al-fitr": "crescent",
  "eid-al-adha": "crescent",
  "green-march": "desert",
  "unity-day": "desert",
  "oued-ed-dahab": "desert",
  "amazigh-new-year": "amazigh",
  "throne-day": "national",
  "independence-day": "national",
  "independence-manifesto": "national",
  "revolution-of-the-king-and-the-people": "national",
  "youth-day": "national",
};

export const sceneFor = (holidayId: string): Scene => SCENES[holidayId] ?? "zellige";

const GOLD = "#ffd27a";
const BRASS = "#e2a948";
const BRASS_DARK = "#7a4e12";

/** Horseshoe arch shared by every scene. */
function Arch() {
  return (
    <g fill="none" stroke="white">
      <path
        d="M346.6 400V296.8A135 135 0 1 1 553.4 296.8V400"
        strokeOpacity={0.22}
        strokeWidth={2.5}
      />
      <path
        d="M359.6 400V285.8A118 118 0 1 1 540.4 285.8V400"
        strokeOpacity={0.12}
        strokeWidth={1.5}
      />
    </g>
  );
}

const sparkle = (x: number, y: number, s: number) =>
  `M${x} ${y - s}L${x + s / 4} ${y - s / 4}L${x + s} ${y}L${x + s / 4} ${y + s / 4}L${x} ${y + s}L${x - s / 4} ${y + s / 4}L${x - s} ${y}L${x - s / 4} ${y - s / 4}Z`;

function Lantern({ x, chain, scale }: { x: number; chain: number; scale: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <g className="motion-safe:animate-sway">
        <line y1={0} y2={chain} stroke={BRASS} strokeOpacity={0.6} strokeWidth={1.5} />
        <g transform={`translate(0 ${chain}) scale(${scale})`}>
          <circle cy={66} r={72} fill="url(#lantern-glow)" />
          <circle cy={4} r={4} fill="none" stroke={BRASS} strokeWidth={2} />
          <path d="M-14 24L0 8L14 24Z" fill={BRASS} />
          <rect x={-18} y={24} width={36} height={5} rx={2} fill={BRASS_DARK} />
          <path d="M-18 29H18L23 44V80L18 95H-18L-23 80V44Z" fill={BRASS} />
          <path d="M-12 86V52A12 12 0 0 1 12 52V86Z" fill="#ffe9b0" />
          <path d="M0 42V88M-12 66H12" stroke={BRASS_DARK} strokeWidth={1.5} />
          <path d="M-14 95L0 108L14 95Z" fill={BRASS} />
          <circle cy={112} r={3} fill={BRASS} />
        </g>
      </g>
    </g>
  );
}

function Crescent() {
  return (
    <>
      <defs>
        <radialGradient id="lantern-glow">
          <stop offset="0" stopColor={GOLD} stopOpacity={0.45} />
          <stop offset="1" stopColor={GOLD} stopOpacity={0} />
        </radialGradient>
        <mask id="crescent-cut">
          <rect width="600" height="400" fill="white" />
          <circle cx={488} cy={138} r={40} fill="black" />
        </mask>
      </defs>
      <Arch />
      <circle cx={470} cy={150} r={46} fill={GOLD} fillOpacity={0.95} mask="url(#crescent-cut)" />
      <path
        d={[
          sparkle(395, 120, 7),
          sparkle(530, 225, 5),
          sparkle(410, 230, 4),
          sparkle(560, 105, 4),
        ].join("")}
        fill={GOLD}
        fillOpacity={0.85}
      />
      <Lantern x={300} chain={150} scale={0.75} />
      <Lantern x={370} chain={40} scale={0.95} />
      <Lantern x={565} chain={95} scale={0.8} />
    </>
  );
}

function Desert() {
  const kasbah =
    "M370 312V238h6v-8h6v8h6v-8h6v8h6V312Z" +
    "M400 312V262h8v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6h8V312Z" +
    "M488 312V228h7v-8h7v8h7v-8h7v8h4V312Z";
  return (
    <>
      <circle cx={470} cy={235} r={88} fill={GOLD} fillOpacity={0.18} />
      <circle cx={470} cy={235} r={58} fill={GOLD} fillOpacity={0.3} />
      <Arch />
      <path
        d="M0 300C120 250 220 262 320 285S520 240 600 262V400H0Z"
        fill="#f3bd57"
        fillOpacity={0.2}
      />
      <path d={kasbah} fill="#3a120a" fillOpacity={0.45} />
      <path d="M440 312V296A8 8 0 0 1 456 296V312Z" fill={GOLD} fillOpacity={0.5} />
      <g stroke="#3a120a" strokeOpacity={0.5} strokeLinecap="round" fill="none">
        <path d="M548 330C543 300 551 268 545 238" strokeWidth={5} />
        <path
          d="M545 238Q520 228 506 244M545 238Q528 214 510 216M545 238Q560 214 580 220M545 238Q570 232 584 250M545 238Q546 220 540 206"
          strokeWidth={3.5}
        />
      </g>
      <path
        d="M0 330C150 292 260 320 360 330S520 300 600 316V400H0Z"
        fill="#f3bd57"
        fillOpacity={0.3}
      />
      <path
        d="M0 370C130 342 300 360 420 372S560 350 600 360V400H0Z"
        fill="#ffe2a8"
        fillOpacity={0.2}
      />
    </>
  );
}

function Amazigh() {
  const lattice = Array.from({ length: 5 }, (_, i) => {
    const y = 90 + i * 50;
    return `M250 ${y}L280 ${y + 25}L250 ${y + 50}M310 ${y}L280 ${y + 25}L310 ${y + 50}`;
  }).join("");
  return (
    <>
      <path d={lattice} fill="none" stroke="white" strokeOpacity={0.2} strokeWidth={2} />
      <Arch />
      <rect y={318} width={600} height={28} fill="#3b82f6" fillOpacity={0.45} />
      <rect y={346} width={600} height={27} fill="#22a35a" fillOpacity={0.45} />
      <rect y={373} width={600} height={27} fill="#f3bd57" fillOpacity={0.5} />
      <g fill="none" stroke="#ef4a3c" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round">
        <path d="M450 112V292" />
        <path d="M450 192C440 170 408 166 408 122M450 192C460 170 492 166 492 122" />
        <path d="M450 212C440 234 408 238 408 282M450 212C460 234 492 238 492 282" />
      </g>
    </>
  );
}

function National() {
  return (
    <>
      <g stroke="white" strokeOpacity={0.07} strokeWidth={2}>
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i * Math.PI) / 8;
          return (
            <line
              key={a}
              x1={450}
              y1={215}
              x2={450 + 260 * Math.cos(a)}
              y2={215 + 260 * Math.sin(a)}
            />
          );
        })}
      </g>
      <Arch />
      <path
        d="M450 120L505.8 291.9L359.6 185.6L540.4 185.6L394.2 291.9Z"
        fill="none"
        stroke="#1f9a55"
        strokeWidth={9}
        strokeLinejoin="miter"
      />
    </>
  );
}

function Zellige() {
  return (
    <>
      <Arch />
      <g fill="none" stroke="white" strokeOpacity={0.18} strokeWidth={2}>
        <path d="M390 155H510V275H390Z" />
        <path d="M450 130L535 215L450 300L365 215Z" />
      </g>
      <path d={sparkle(450, 215, 14)} fill={GOLD} fillOpacity={0.6} />
    </>
  );
}

const ART: Record<Scene, () => ReactNode> = {
  crescent: Crescent,
  desert: Desert,
  amazigh: Amazigh,
  national: National,
  zellige: Zellige,
};

export function HolidayScene({ scene, className }: { scene: Scene; className?: string }) {
  const Art = ART[scene];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 400"
      preserveAspectRatio="xMaxYMax meet"
      data-scene-art={scene}
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-45 sm:opacity-100 rtl:-scale-x-100",
        className,
      )}
    >
      {/* Fades the art's own start edge, wherever the scene sits in the hero. */}
      <defs>
        <linearGradient id="scene-fade-gradient">
          <stop offset="0" stopColor="black" />
          <stop offset="0.4" stopColor="white" />
        </linearGradient>
        <mask id="scene-fade" maskUnits="userSpaceOnUse" x={0} y={0} width={600} height={400}>
          <rect width={600} height={400} fill="url(#scene-fade-gradient)" />
        </mask>
      </defs>
      <g mask="url(#scene-fade)">
        <Art />
      </g>
    </svg>
  );
}
