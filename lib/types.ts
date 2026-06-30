export type Screen =
  | "landing"
  | "consent"
  | "name"
  | "keyboard"
  | "mouse-dot"
  | "mouse-drag"
  | "analytics"
  | "done";

export interface KeyEvent {
  // existing fields — unchanged
  key_id: string;
  key_category: "alphanum" | "symbol" | "special" | "space";
  press_ts: number;
  release_ts: number | null;
  segment: "pangram" | "free";
  // new: modifier co-press
  shift_held: boolean;       // was Shift physically down when this key was pressed?
  shift_hold_ms: number;     // how long Shift had been held before this keypress (0 if not held)
}

export interface KeyboardExtras {
  // new: IKI sequence array (inter-keystroke intervals in ms, for sequence models)
  iki_sequence: number[];
  // new: trigraph timings { abc: avg_ms }
  trigraph_timings: Record<string, number>;
  // new: backspace pattern
  backspace_positions: number[];   // typed-string index where each backspace occurred
  backspace_count: number;
  // new: drift — first-half vs second-half IKI mean difference
  drift_iki_ms: number;
  // new: cyclical time encoding (hour-of-day)
  time_sin: number;
  time_cos: number;
}

export interface MousePoint {
  // existing — unchanged
  x: number;
  y: number;
  ts: number;
  dx: number;
  dy: number;
  // new: pointer pressure (0–1; always 0.5 on desktop mouse, real value on stylus/touch)
  pressure: number;
}

export interface PathPoint {
  x: number;
  y: number;
  ts: number;
  pressure: number;
}

export interface PathKinematics {
  // derived from path — computed at collection time so it's in the raw export
  velocities: number[];       // px/s per segment
  accelerations: number[];    // px/s² per segment
  jerks: number[];            // px/s³ per segment
  sub_movement_count: number; // direction reversals along path
  angle_of_approach_deg: number; // bearing of final 20% of path toward target
  hover_dwell_ms: number;     // time cursor was within 2× target radius before click
}

export interface DotTrial {
  // existing — unchanged
  target_x: number;
  target_y: number;
  click_x: number;
  click_y: number;
  appeared_at: number;
  clicked_at: number;
  travel_time_ms: number;
  error_px: number;
  path: PathPoint[];
  // new
  kinematics: PathKinematics;
}

export interface DragTrial {
  // existing — unchanged
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  zone_x: number;
  zone_y: number;
  started_at: number;
  ended_at: number;
  duration_ms: number;
  success: boolean;
  path: PathPoint[];
  // new
  kinematics: PathKinematics;
}

// ─── SESSION ───────────────────────────────────────────────────────────────

export interface SessionData {
  subject_id: string;
  collected_at: string;
  duration_ms: number;
  keyboard: {
    events: KeyEvent[];
    pangram_text_length: number;
    free_text_length: number;
    extras: KeyboardExtras;   // new block — doesn't touch existing fields
  };
  mouse: {
    passive_points: MousePoint[];
    dot_trials: DotTrial[];
    drag_trials: DragTrial[];
  };
}
