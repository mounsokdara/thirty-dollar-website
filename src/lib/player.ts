import type { ActionId, Operator, SeqItem } from "./types";
import { DEFAULT_TEMPO, DEFAULT_VOLUME } from "./types";
import { clamp } from "./utils";
import { cutSounds, currentTime, playSound, stopSounds } from "./audio";
import { semitonesToRate } from "./utils";

export type CompiledEvent = {
  index: number;
  time: number;
  soundId?: string;
  pitch?: number;
  volume?: number;
  pan?: number;
  action?: ActionId;
  bpm?: number;
  volumePct?: number;
  transposition?: number;
  remaining?: number;
  duration?: number;
  finished?: boolean;
  pulse?: boolean;
  trigger?: boolean;
  untriggered?: number[];
  target?: number;
  count?: number;
  frequency?: number;
  pulseId?: number;
  stopPulses?: boolean;
  bgColor?: string;
  fadeTime?: number;
  uid: string;
  soundTarget?: string;
  jumpUid?: string;
};

function modifyNumber(num: number, next: number, op?: Operator) {
  switch (op) {
    case "add":
      return num + next;
    case "multiply":
      return num * next;
    case "divide":
      return next <= 0 ? num : num / next;
    default:
      return next;
  }
}

function beatLength(bpm: number) {
  return (60 / bpm) * 1000;
}

const MAX_ITERS = 80_000;

export function compileSequence(
  items: SeqItem[],
  opts: { selectedSection: number } = { selectedSection: -1 },
): CompiledEvent[] {
  const order: CompiledEvent[] = [];
  let bpm = DEFAULT_TEMPO;
  let volume = DEFAULT_VOLUME;
  let loopTarget = 0;
  let transposition = 0;
  let index = 0;
  let timer = 0;
  let pulseId = 0;
  let iters = 0;

  const seq = items.map((it, i) => ({
    ...it,
    index: i,
    triggered: false,
    remaining: undefined as number | undefined,
  }));

  const groups = sectionOf(items);
  let scrubPos = 0;
  const startPositions = seq
    .map((x, i) => ({ x, i }))
    .filter(({ x, i }) => x.kind === "action" && x.actionId === "startpos" && (opts.selectedSection < 0 || groups[i] === opts.selectedSection));
  if (startPositions.length) scrubPos = startPositions[startPositions.length - 1]!.i;
  else if (opts.selectedSection >= 0) {
    const first = groups.findIndex((g) => g === opts.selectedSection);
    scrubPos = first >= 0 ? first : 0;
  }
  let scrubbing = scrubPos > 0;

  const untrigger = (idx: number, except: string[]) => {
    const list: number[] = [];
    for (let y = idx + 1; y < seq.length; y++) {
      const x = seq[y]!;
      if (x.kind === "action" && except.includes(x.actionId)) continue;
      if (x.triggered) {
        x.triggered = false;
        list.push(y);
      }
      if ((x.remaining ?? 1) <= 0) {
        x.remaining = undefined;
        list.push(y);
      }
    }
    return list;
  };

  while (index < seq.length && iters++ < MAX_ITERS) {
    const x = seq[index]!;
    let incrementTimer = false;
    if (scrubbing && index === scrubPos) scrubbing = false;

    if (x.kind === "sound") {
      const vol = Number.isFinite(x.volume) ? x.volume : 100;
      const next = seq[index + 1];
      if (!(next && next.kind === "action" && next.actionId === "combine")) incrementTimer = true;
      if (!scrubbing) {
        order.push({
          index,
          uid: x.uid,
          time: timer / 1000,
          soundId: x.soundId,
          volume: volume * clamp(vol / 100, 0, 4),
          pan: clamp(x.pan || 0, -100, 100),
          pitch: clamp((x.pitch || 0) + transposition, -72, 72),
        });
      }
    } else {
      const val = Number(x.amount) || 0;
      const actionObj: CompiledEvent = {
        index,
        uid: x.uid,
        action: x.actionId,
        pulse: true,
        trigger: true,
        time: timer / 1000,
        soundTarget: x.soundTarget,
      };
      let skip = false;

      switch (x.actionId) {
        case "speed":
          bpm = clamp(modifyNumber(bpm, val, x.operator), 5, 20000);
          actionObj.bpm = Number(bpm.toFixed(4));
          break;
        case "volume":
          volume = clamp(modifyNumber(volume, val, x.operator), 0, 600);
          actionObj.volumePct = Number(volume.toFixed(4));
          break;
        case "stop": {
          let left = x.remaining ?? val;
          if (!scrubbing && left > 0) {
            const take = Math.min(1, left);
            timer += beatLength(bpm) * take;
            left -= 1;
            if (left < 0) left = 0;
            actionObj.remaining = left;
            x.remaining = left;
            index -= 1;
            actionObj.trigger = false;
          } else {
            actionObj.finished = true;
            actionObj.duration = val;
          }
          break;
        }
        case "loopmany": {
          let left = x.remaining ?? val;
          if (!scrubbing && left > 0) {
            left -= 1;
            actionObj.remaining = left;
            x.remaining = left;
            index = loopTarget - 1;
            if (left < 1) actionObj.pulse = false;
            else actionObj.trigger = false;
            actionObj.untriggered = untrigger(index, ["loopmany"]);
          } else skip = true;
          break;
        }
        case "loop":
          if (!x.triggered) {
            x.triggered = true;
            index = loopTarget - 1;
            actionObj.untriggered = untrigger(index, ["loop", "loopmany"]);
          } else skip = true;
          break;
        case "looptarget":
          loopTarget = index;
          break;
        case "combine":
          if (scrubbing) skip = true;
          break;
        case "jump":
          if (!x.triggered) {
            const found = seq.findIndex(
              (e) => e.kind === "action" && e.actionId === "target" && !e.triggered && e.amount === x.amount,
            );
            if (found >= 0) {
              x.triggered = true;
              actionObj.target = found;
              actionObj.jumpUid = seq[found]!.uid;
              index = found;
            }
            actionObj.untriggered = untrigger(index, ["loop", "loopmany", "jump", "target"]);
          } else skip = true;
          break;
        case "target":
          actionObj.trigger = false;
          actionObj.pulse = false;
          break;
        case "transpose":
          transposition = clamp(modifyNumber(transposition, val, x.operator), -60, 60);
          actionObj.transposition = Number(transposition.toFixed(4));
          break;
        case "pulse": {
          if (scrubbing) skip = true;
          else {
            actionObj.count = Math.floor(clamp(Number(x.val1) || 0, 0, 1000));
            actionObj.frequency = clamp(Number(x.val2) || 0, 0, 1000);
            actionObj.trigger = false;
            actionObj.pulseId = pulseId;
            if (!actionObj.frequency) skip = true;
            if (!skip && actionObj.count > 1 && actionObj.frequency > 0) {
              for (let i = 1; i < actionObj.count; i++) {
                const pulseTime = timer + beatLength(bpm) * actionObj.frequency * i;
                order.push({
                  index,
                  uid: x.uid,
                  action: "pulse",
                  pulse: true,
                  pulseId,
                  trigger: i === actionObj.count - 1,
                  time: pulseTime / 1000,
                });
              }
              pulseId++;
            } else actionObj.trigger = true;
            if (actionObj.count < 1) actionObj.stopPulses = true;
          }
          break;
        }
        case "bg":
          actionObj.bgColor = typeof x.val1 === "string" && /^#[a-f0-9]{6}$/i.test(x.val1) ? x.val1 : "#36393c";
          actionObj.fadeTime = scrubbing ? 0.1 : clamp(Number(x.val2) || 0, 0, 200);
          break;
        default:
          break;
      }
      if (!skip) order.push(actionObj);
    }

    index++;
    if (!scrubbing && incrementTimer) timer += beatLength(bpm);
  }

  return order.sort((a, b) => a.time - b.time);
}

export function sectionOf(items: SeqItem[]): number[] {
  const groups: number[] = [];
  let g = 0;
  for (const it of items) {
    groups.push(g);
    if (it.kind === "action" && it.actionId === "divider") g += 1;
  }
  return groups;
}

export type PlayHooks = {
  invertPan: boolean;
  noAnimations: boolean;
  autoScroll: boolean;
  onBounce: (uid: string) => void;
  onPulse: (uid: string) => void;
  onTrigger: (uid: string) => void;
  onUntrigger: (indices: number[]) => void;
  onTempo: (bpm: number) => void;
  onVolume: (vol: number) => void;
  onTranspose: (t: number) => void;
  onCountdown: (uid: string, text: string) => void;
  onFlash: () => void;
  onScreenPulse: () => void;
  onBg: (color: string, fade: number) => void;
  onScrollTo: (uid: string) => void;
  onDone: () => void;
  shouldStop: () => boolean;
};

export function runCompiled(events: CompiledEvent[], hooks: PlayHooks) {
  const start = currentTime();
  let nextSound = 0;
  let nextAction = 0;
  let lastPulse = 0;
  let lastPos = -200;
  let soundTimer: number | null = null;
  let raf = 0;
  let stopped = false;

  const queueAhead = 5;

  const queueSounds = () => {
    if (stopped || hooks.shouldStop()) return;
    const now = currentTime();
    for (; nextSound < events.length; nextSound++) {
      const x = events[nextSound]!;
      if (start + x.time > now + queueAhead) break;
      if (x.action === "cut") {
        cutSounds(start + x.time, x.soundTarget);
      } else if (x.soundId) {
        playSound(x.soundId, {
          pitch: semitonesToRate(clamp(x.pitch ?? 0, -72, 72)),
          playAt: start + x.time,
          volume: (x.volume ?? 100) / 200,
          pan: x.pan,
          invertPan: hooks.invertPan,
        });
      }
    }
    if (nextSound < events.length) {
      soundTimer = window.setTimeout(queueSounds, 1000);
    }
  };

  const checkActions = () => {
    if (stopped || hooks.shouldStop()) return;
    const now = currentTime();
    for (; nextAction < events.length; nextAction++) {
      const x = events[nextAction]!;
      if (start + x.time > now) break;

      if (x.soundId) {
        if (!hooks.noAnimations) hooks.onBounce(x.uid);
      } else if (x.action && !hooks.noAnimations) {
        if (x.pulse) hooks.onPulse(x.uid);
        if (x.trigger) hooks.onTrigger(x.uid);
        if (x.untriggered?.length) hooks.onUntrigger(x.untriggered);

        switch (x.action) {
          case "speed":
            if (x.bpm) hooks.onTempo(x.bpm);
            break;
          case "volume":
            if (x.volumePct != null) hooks.onVolume(x.volumePct);
            break;
          case "transpose":
            if (x.transposition != null) hooks.onTranspose(x.transposition);
            break;
          case "stop":
            hooks.onCountdown(x.uid, x.finished ? String(x.duration) : String((x.remaining ?? 0) + 1));
            break;
          case "loopmany":
            hooks.onCountdown(x.uid, (x.remaining ?? 0) <= 0 ? "" : String(x.remaining));
            break;
          case "jump":
            if (x.jumpUid) {
              hooks.onPulse(x.jumpUid);
              hooks.onTrigger(x.jumpUid);
            }
            break;
          case "flash":
            hooks.onFlash();
            break;
          case "pulse":
            if ((x.pulseId ?? 0) > lastPulse) lastPulse = x.pulseId ?? 0;
            if (!x.stopPulses && lastPulse === (x.pulseId ?? 0)) hooks.onScreenPulse();
            break;
          case "bg":
            if (x.bgColor) hooks.onBg(x.bgColor, x.fadeTime ?? 0);
            break;
          default:
            break;
        }
      }

      if (hooks.autoScroll) {
        if (Math.abs(nextAction - lastPos) > 8) {
          hooks.onScrollTo(x.uid);
          lastPos = nextAction;
        }
      }
    }

    if (nextAction < events.length) {
      raf = requestAnimationFrame(checkActions);
    } else {
      // Sequence beat clock is done — let samples ring out. Original cancel({ keepAnimations: true })
      // does not call stopSounds().
      hooks.onDone();
    }
  };

  queueSounds();
  raf = requestAnimationFrame(checkActions);

  return (cut = false) => {
    stopped = true;
    if (soundTimer) clearTimeout(soundTimer);
    if (raf) cancelAnimationFrame(raf);
    if (cut) stopSounds();
  };
}
