"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { KeyEvent } from "@/lib/types";
import { normaliseKey } from "@/lib/keyUtils";

const PANGRAMS = [
  "the quick brown fox jumps over the lazy dog",
  "pack my box with five dozen liquor jugs",
  "how vexingly quick daft zebras jump",
  "the five boxing wizards jump quickly",
  "sphinx of black quartz judge my vow",
];

interface DialogueOption {
  movie: string;
  lang: "english" | "hinglish";
  line: string;
}

const DIALOGUES: DialogueOption[] = [
  {
    movie: "The Dark Knight",
    lang: "english",
    line: "you either die a hero or live long enough to see yourself become the villain",
  },
  {
    movie: "The Godfather",
    lang: "english",
    line: "i'm gonna make him an offer he can't refuse",
  },
  {
    movie: "Sholay (Hinglish)",
    lang: "hinglish",
    line: "arre o sambha, kitne aadmi the",
  },
  {
    movie: "Kal Ho Naa Ho (Hinglish)",
    lang: "hinglish",
    line: "har pal yahan jee bhar ke jiyo, jo hai samaa kal ho naa ho",
  },
];

const SEGMENT_SECONDS = 90;

export default function KeyboardTest({
  onComplete,
}: {
  onComplete: (events: KeyEvent[], pangramLen: number, dialogueLen: number) => void;
}) {
  const [segment, setSegment] = useState<"pangram" | "picker" | "dialogue">("pangram");
  const [secondsLeft, setSecondsLeft] = useState(SEGMENT_SECONDS);
  const [typed, setTyped] = useState("");
  const [target, setTarget] = useState(PANGRAMS[0]);
  const [pangramIdx, setPangramIdx] = useState(0);
  const [dialogue, setDialogue] = useState<DialogueOption | null>(null);
  const eventsRef = useRef<KeyEvent[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const pangramCharsTyped = useRef(0);
  const dialogueCharsTyped = useRef(0);
  const pendingFinish = useRef(false);

  const finishSegment = useCallback(() => {
    if (segment === "pangram") {
      setSegment("picker");
    } else if (segment === "dialogue") {
      onComplete(eventsRef.current, pangramCharsTyped.current, dialogueCharsTyped.current);
    }
  }, [segment, onComplete]);

  // run side effects (segment transitions) outside of the setState updater
  useEffect(() => {
    if (pendingFinish.current) {
      pendingFinish.current = false;
      finishSegment();
    }
  }, [secondsLeft, finishSegment]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [segment]);

  useEffect(() => {
    if (segment === "picker") return; // timer paused while choosing a dialogue
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          pendingFinish.current = true;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [segment]);

  function pickDialogue(d: DialogueOption) {
    setDialogue(d);
    setTarget(d.line);
    setTyped("");
    setSecondsLeft(SEGMENT_SECONDS);
    setSegment("dialogue");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) return;
    const { id, category } = normaliseKey(e.key);
    const ts = performance.now();
    eventsRef.current.push({
      key_id: id,
      key_category: category,
      press_ts: ts,
      release_ts: null,
      segment: segment === "dialogue" ? "free" : "pangram",
    });
  }

  function handleKeyUp(e: React.KeyboardEvent<HTMLInputElement>) {
    if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) return;
    const ts = performance.now();
    // attach release to the most recent open event for this key id
    const { id } = normaliseKey(e.key);
    for (let i = eventsRef.current.length - 1; i >= 0; i--) {
      const ev = eventsRef.current[i];
      if (ev.key_id === id && ev.release_ts === null) {
        ev.release_ts = ts;
        break;
      }
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (segment === "pangram") {
      pangramCharsTyped.current += Math.max(0, val.length - typed.length);
      if (val.length >= target.length) {
        const next = (pangramIdx + 1) % PANGRAMS.length;
        setPangramIdx(next);
        setTarget(PANGRAMS[next]);
        setTyped("");
        return;
      }
    } else if (segment === "dialogue") {
      dialogueCharsTyped.current += Math.max(0, val.length - typed.length);
      if (val.length >= target.length) {
        setTyped("");
        return;
      }
    }
    setTyped(val);
  }

  const progressPct = (secondsLeft / SEGMENT_SECONDS) * 100;

  if (segment === "picker") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-xl w-full fade-up">
          <div className="font-mono-tight text-xs uppercase tracking-[0.3em] text-amber mb-3 text-center">
            segment 2 · pick a line to type
          </div>
          <h2 className="text-xl font-semibold mb-6 text-center">
            Choose a dialogue — you'll type it on repeat for 90 seconds
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {DIALOGUES.map((d) => (
              <button
                key={d.movie}
                onClick={() => pickDialogue(d)}
                className="text-left bg-surface border border-border rounded-lg p-4 hover:border-amber transition group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono-tight text-sm text-text group-hover:text-amber transition">
                    {d.movie}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted">
                    {d.lang}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">&ldquo;{d.line}&rdquo;</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl w-full fade-up">
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono-tight text-xs uppercase tracking-[0.3em] text-amber">
            {segment === "pangram" ? "segment 1 · repeat the line" : `segment 2 · ${dialogue?.movie ?? ""}`}
          </span>
          <span className="font-mono-tight text-lg text-text tabular-nums">
            0:{secondsLeft.toString().padStart(2, "0")}
          </span>
        </div>

        <div className="h-1 w-full bg-border rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-amber transition-all duration-1000 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="font-mono-tight text-xl leading-relaxed mb-8 select-none">
          {target.split("").map((ch, i) => {
            const typedCh = typed[i];
            let cls = "text-muted";
            if (typedCh != null) cls = typedCh === ch ? "text-cyan" : "text-danger";
            if (i === typed.length) cls += " border-l-2 border-amber";
            return (
              <span key={i} className={cls}>
                {ch}
              </span>
            );
          })}
        </div>

        <input
          ref={inputRef}
          value={typed}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          className="absolute opacity-0 pointer-events-none"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <div
          onClick={() => inputRef.current?.focus()}
          className="text-center text-xs text-muted font-mono-tight cursor-text"
        >
          click anywhere here and just start typing
        </div>
      </div>
    </div>
  );
}
