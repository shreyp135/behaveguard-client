import { KeyEvent, KeyboardExtras, PathPoint, PathKinematics } from "./types";

// ─── PATH KINEMATICS ───────────────────────────────────────────────────────

export function computePathKinematics(
  path: PathPoint[],
  targetX: number,
  targetY: number,
  targetRadius: number
): PathKinematics {
  if (path.length < 2) {
    return {
      velocities: [],
      accelerations: [],
      jerks: [],
      sub_movement_count: 0,
      angle_of_approach_deg: 0,
      hover_dwell_ms: 0,
    };
  }

  // velocities (px/s) between consecutive points
  const velocities: number[] = [];
  for (let i = 1; i < path.length; i++) {
    const dt = (path[i].ts - path[i - 1].ts) / 1000;
    const dist = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    velocities.push(dt > 0 ? dist / dt : 0);
  }

  // accelerations (px/s²)
  const accelerations: number[] = [];
  for (let i = 1; i < velocities.length; i++) {
    const dt = (path[i].ts - path[i - 1].ts) / 1000;
    accelerations.push(dt > 0 ? (velocities[i] - velocities[i - 1]) / dt : 0);
  }

  // jerks (px/s³)
  const jerks: number[] = [];
  for (let i = 1; i < accelerations.length; i++) {
    const dt = (path[i].ts - path[i - 1].ts) / 1000;
    jerks.push(dt > 0 ? (accelerations[i] - accelerations[i - 1]) / dt : 0);
  }

  // sub-movements: count direction reversals in velocity profile
  let sub_movement_count = 0;
  for (let i = 1; i < velocities.length - 1; i++) {
    if (velocities[i] < velocities[i - 1] && velocities[i] < velocities[i + 1]) {
      sub_movement_count++;
    }
  }

  // angle of approach: bearing over final 20% of path toward target
  const tailStart = Math.max(0, Math.floor(path.length * 0.8));
  const tail = path.slice(tailStart);
  let angle_of_approach_deg = 0;
  if (tail.length >= 2) {
    const dx = targetX - tail[0].x;
    const dy = targetY - tail[0].y;
    angle_of_approach_deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
  }

  // hover dwell: cumulative time cursor was within 2× target radius before click
  const hoverRadius = targetRadius * 2;
  let hover_dwell_ms = 0;
  for (let i = 1; i < path.length; i++) {
    const dist = Math.hypot(path[i].x - targetX, path[i].y - targetY);
    if (dist <= hoverRadius) {
      hover_dwell_ms += path[i].ts - path[i - 1].ts;
    }
  }

  return {
    velocities: velocities.map((v) => Math.round(v)),
    accelerations: accelerations.map((a) => Math.round(a)),
    jerks: jerks.map((j) => Math.round(j)),
    sub_movement_count,
    angle_of_approach_deg,
    hover_dwell_ms: Math.round(hover_dwell_ms),
  };
}

// ─── KEYBOARD EXTRAS ───────────────────────────────────────────────────────

export function computeKeyboardExtras(events: KeyEvent[]): KeyboardExtras {
  const alphaEvents = events
    .filter((e) => e.key_category === "alphanum" || e.key_category === "space")
    .sort((a, b) => a.press_ts - b.press_ts);

  // IKI sequence
  const iki_sequence: number[] = [];
  for (let i = 1; i < alphaEvents.length; i++) {
    const iki = alphaEvents[i].press_ts - alphaEvents[i - 1].press_ts;
    if (iki >= 0 && iki < 2000) iki_sequence.push(Math.round(iki));
  }

  // trigraph timings — 3-key windows of alphanum keys
  const trigraphMap = new Map<string, number[]>();
  for (let i = 2; i < alphaEvents.length; i++) {
    const triplet = [alphaEvents[i - 2], alphaEvents[i - 1], alphaEvents[i]];
    const key = triplet.map((e) => e.key_id).join("");
    if (key.includes("other")) continue;
    const span = triplet[2].press_ts - triplet[0].press_ts;
    if (span < 0 || span > 3000) continue;
    if (!trigraphMap.has(key)) trigraphMap.set(key, []);
    trigraphMap.get(key)!.push(Math.round(span));
  }
  const trigraph_timings: Record<string, number> = {};
  trigraphMap.forEach((arr, key) => {
    if (arr.length >= 2) {
      trigraph_timings[key] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    }
  });

  // backspace pattern
  const backspaceEvents = events.filter((e) => e.key_id === "backspace");
  const backspace_count = backspaceEvents.length;
  // estimate position: count alphanum/space events before each backspace
  const backspace_positions: number[] = backspaceEvents.map((bs) => {
    return events
      .filter((e) => e.press_ts < bs.press_ts && (e.key_category === "alphanum" || e.key_category === "space"))
      .length;
  });

  // drift: IKI mean of first half vs second half
  let drift_iki_ms = 0;
  if (iki_sequence.length >= 10) {
    const half = Math.floor(iki_sequence.length / 2);
    const firstHalf = iki_sequence.slice(0, half);
    const secondHalf = iki_sequence.slice(half);
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    drift_iki_ms = Math.round(mean(secondHalf) - mean(firstHalf));
  }

  // cyclical time encoding for hour-of-day
  const now = new Date();
  const hourFraction = now.getHours() + now.getMinutes() / 60;
  const time_sin = parseFloat(Math.sin((2 * Math.PI * hourFraction) / 24).toFixed(4));
  const time_cos = parseFloat(Math.cos((2 * Math.PI * hourFraction) / 24).toFixed(4));

  return {
    iki_sequence,
    trigraph_timings,
    backspace_positions,
    backspace_count,
    drift_iki_ms,
    time_sin,
    time_cos,
  };
}
