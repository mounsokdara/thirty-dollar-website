import { clamp } from "./utils";
import { SOUNDS, getSound, soundFileUrl } from "./sounds";
import { asset } from "./asset";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<string, AudioBuffer | null>();
const fetching = new Map<string, Promise<AudioBuffer | null>>();
const intros = new Map<number, AudioBuffer>();
let warming = false;

const INTRO_PATHS = [
  asset("assets/dont_you_lecture_me.wav"),
  asset("assets/you_deadass_built_like_a.wav"),
  asset("assets/white_people_be_like.wav"),
];

type Voice = {
  src: AudioBufferSourceNode;
  gain: GainNode;
  id: string;
  start: number;
  cut: boolean;
  finished: boolean;
};

let voices: Voice[] = [];
let introNode: AudioBufferSourceNode | null = null;

export function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  return ctx;
}

export function unlockAudio() {
  const c = getAudioContext();
  if (!c) return;
  if (c.state === "suspended" || (c.state as string) === "interrupted") {
    void c.resume();
  }
  if (!warming) warmupSounds();
}

export function currentTime() {
  return getAudioContext()?.currentTime ?? 0;
}

function whenContextReady(cb: (c: AudioContext) => void) {
  const c = getAudioContext();
  if (!c) return;
  if (c.state === "running") {
    cb(c);
    return;
  }
  void c.resume().then(() => cb(c)).catch(() => cb(c));
}

async function decodeUrl(url: string): Promise<AudioBuffer | null> {
  const c = getAudioContext();
  if (!c) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.arrayBuffer();
    if (data.byteLength < 64) return null;
    return await c.decodeAudioData(data.slice(0));
  } catch {
    return null;
  }
}

export async function loadBuffer(id: string): Promise<AudioBuffer | null> {
  if (!id || id === "_pause") return null;
  if (buffers.has(id)) return buffers.get(id) ?? null;
  const pending = fetching.get(id);
  if (pending) return pending;
  const task = decodeUrl(soundFileUrl(id)).then((buf) => {
    buffers.set(id, buf);
    fetching.delete(id);
    return buf;
  });
  fetching.set(id, task);
  return task;
}

export function warmupSounds() {
  if (warming) return;
  const c = getAudioContext();
  if (!c) return;
  warming = true;
  const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
  let i = 0;
  const tick = () => {
    const slice = SOUNDS.slice(i, i + 8);
    i += 8;
    for (const s of slice) {
      if (s.id !== "_pause") void loadBuffer(s.id);
    }
    if (i < SOUNDS.length) idle(tick);
  };
  idle(tick);
}

export async function preloadIds(ids: string[]) {
  const unique = [...new Set(ids.filter((id) => id && id !== "_pause"))];
  await Promise.all(unique.map((id) => loadBuffer(id)));
}

export function playSound(
  id: string,
  opts: {
    pitch?: number;
    volume?: number;
    pan?: number;
    playAt?: number;
    stopPrevious?: boolean;
    invertPan?: boolean;
  } = {},
) {
  if (!id || id === "_pause") return;
  const def = getSound(id);
  const realId = def?.id ?? id;

  const startVoice = (buf: AudioBuffer | null) => {
    if (!buf || buf.duration <= 0) return;
    whenContextReady((c) => {
      const dest = master;
      if (!dest) return;

      if (opts.stopPrevious) {
        voices.forEach((v) => {
          if (v.id === realId && !v.finished) killVoice(v, false);
        });
        voices = voices.filter((v) => !v.finished);
      }

      const src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = opts.pitch && opts.pitch > 0 ? opts.pitch : 1;

      const gain = c.createGain();
      const vol = Number.isFinite(opts.volume) ? (opts.volume as number) : 0.5;
      gain.gain.value = clamp(vol, 0, 3);

      let panVal = opts.pan ?? 0;
      if (opts.invertPan) panVal *= -1;
      if (panVal) {
        const pan = c.createStereoPanner();
        pan.pan.value = clamp(panVal / 100, -1, 1);
        src.connect(pan);
        pan.connect(gain);
      } else {
        src.connect(gain);
      }
      gain.connect(dest);

      // Never pass a time in the past (or 0 after the clock has moved) — that
      // skips into the buffer and instantly ends any sample shorter than currentTime.
      const now = c.currentTime;
      const scheduled = typeof opts.playAt === "number" ? opts.playAt : NaN;
      const when = Number.isFinite(scheduled) && scheduled > now + 0.002 ? scheduled : now;

      const voice: Voice = { src, gain, id: realId, start: when, cut: false, finished: false };
      voices.push(voice);
      try {
        src.start(when);
      } catch {
        try {
          src.start();
        } catch {
          /* already started */
        }
      }
      src.addEventListener("ended", () => killVoice(voice, true, false));
    });
  };

  const cached = buffers.get(realId);
  if (cached) {
    startVoice(cached);
    return;
  }
  void loadBuffer(realId).then(startVoice);
}

function killVoice(v: Voice, prune: boolean, hard = true) {
  if (v.finished) return;
  v.finished = true;
  if (hard) {
    try {
      v.src.stop();
    } catch {
      /* already stopped */
    }
  }
  try {
    v.src.disconnect();
    v.gain.disconnect();
  } catch {
    /* ok */
  }
  if (prune) voices = voices.filter((x) => !x.finished);
}

export function stopSounds(filterId?: string) {
  voices.forEach((v) => {
    if (!filterId || v.id === filterId) killVoice(v, false);
  });
  voices = voices.filter((v) => !v.finished);
}

export function cutSounds(time: number, filterId?: string) {
  const resolved = filterId ? getSound(filterId)?.id ?? filterId : undefined;
  voices.forEach((v) => {
    if (v.cut || v.finished) return;
    if (resolved && v.id !== resolved) return;
    if (v.start <= time) {
      v.cut = true;
      try {
        v.src.stop(time);
      } catch {
        try {
          v.src.stop();
        } catch {
          /* ok */
        }
      }
    }
  });
}

export async function playIntro(kind: number, onEnded: () => void) {
  stopIntro();
  const c = getAudioContext();
  const dest = master;
  if (!c || !dest) {
    onEnded();
    return;
  }
  unlockAudio();
  let buf = intros.get(kind);
  if (!buf) {
    const path = INTRO_PATHS[kind % INTRO_PATHS.length]!;
    const decoded = await decodeUrl(path);
    if (!decoded) {
      onEnded();
      return;
    }
    buf = decoded;
    intros.set(kind, buf);
  }
  whenContextReady((ac) => {
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    gain.gain.value = 0.85;
    src.connect(gain);
    gain.connect(dest);
    introNode = src;
    src.addEventListener("ended", () => {
      if (introNode === src) {
        introNode = null;
        onEnded();
      }
    });
    try {
      src.start(ac.currentTime);
    } catch {
      onEnded();
    }
  });
}

export function stopIntro() {
  if (!introNode) return;
  try {
    introNode.stop();
    introNode.disconnect();
  } catch {
    /* ok */
  }
  introNode = null;
}

export { semitonesToRate } from "./utils";
