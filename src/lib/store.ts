import { create } from "zustand";
import { ACTION_MAP } from "./actions";
import { DEFAULT_BG, DEFAULT_SETTINGS, DEFAULT_TEMPO, DEFAULT_VOLUME, type ActionId, type Operator, type SeqItem, type Settings } from "./types";
import { parseSequence, serializeSequence, DEMO_SEQUENCE } from "./format";
import { uid } from "./utils";
import { clamp } from "./utils";

const SETTINGS_KEY = "tdw-settings";
const SEQ_KEY = "tdw-sequence";
const NAME_KEY = "tdw-filename";

function loadSettings(): Settings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function loadSequence(): SeqItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SEQ_KEY);
    if (raw === null) return parseSequence(DEMO_SEQUENCE);
    return parseSequence(raw);
  } catch {
    return parseSequence(DEMO_SEQUENCE);
  }
}

export type Modal =
  | null
  | { type: "speed" | "volume" | "stop" | "transpose" | "loopmany" | "pulse" | "bg" | "clear" | "settings" | "shortcuts" | "tips" | "install" };

type BoardState = {
  sequence: SeqItem[];
  settings: Settings;
  filename: string;
  unsaved: boolean;
  playing: boolean;
  hoverSound: { name: string; origin: string } | null;
  hoverAction: { name: string; key: string } | null;
  selectedSection: number;
  hiddenSections: number[];
  bpm: number;
  volumePct: number;
  transpose: number;
  bg: string;
  bgFade: number;
  flash: number;
  pulse: number;
  bounce: Record<string, number>;
  pulseTick: Record<string, number>;
  placed: Record<string, number>;
  triggered: Record<string, boolean>;
  countdown: Record<string, string>;
  introIndex: number;
  modal: Modal;
  editingUid: string | null;
  pendingStart: boolean;
  soundTargetId: string | null;
  hotbarTab: "sounds" | "notes" | "percussion" | "recent" | "actions";
  recent: string[];
  shift: boolean;
  alt: boolean;
  ctrl: boolean;

  hydrate: () => void;
  setKeys: (p: { shift?: boolean; alt?: boolean; ctrl?: boolean }) => void;
  setHoverSound: (v: BoardState["hoverSound"]) => void;
  setHoverAction: (v: BoardState["hoverAction"]) => void;
  setModal: (m: Modal) => void;
  setFilename: (n: string) => void;
  persist: () => void;
  addSound: (soundId: string, atStart?: boolean) => void;
  addAction: (actionId: ActionId, extra?: Partial<Extract<SeqItem, { kind: "action" }>>, atStart?: boolean) => void;
  removeAt: (uid: string) => void;
  duplicate: (uid: string, toEnd?: boolean) => void;
  moveItem: (from: number, to: number) => void;
  updateItem: (uid: string, patch: Partial<SeqItem>) => void;
  clearAll: () => void;
  loadItems: (items: SeqItem[], name?: string) => void;
  setPlaying: (v: boolean) => void;
  setPlayback: (p: Partial<Pick<BoardState, "bpm" | "volumePct" | "transpose">>) => void;
  bumpBounce: (uid: string) => void;
  bumpPulse: (uid: string) => void;
  bumpPlaced: (uid: string) => void;
  setTriggered: (uid: string, v: boolean) => void;
  clearAnim: (keep?: boolean) => void;
  setCountdown: (uid: string, text: string) => void;
  setBg: (color: string, fade: number) => void;
  bumpFlash: () => void;
  bumpScreenPulse: () => void;
  cycleIntro: () => void;
  setSelectedSection: (n: number) => void;
  toggleSectionHidden: (n: number) => void;
  patchSettings: (p: Partial<Settings>) => void;
  setHotbarTab: (t: BoardState["hotbarTab"]) => void;
  pushRecent: (id: string) => void;
  setSoundTarget: (id: string | null) => void;
  setEditing: (uid: string | null) => void;
};

function persistAll(get: () => BoardState) {
  if (typeof window === "undefined") return;
  const s = get();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s.settings));
  localStorage.setItem(SEQ_KEY, serializeSequence(s.sequence));
  localStorage.setItem(NAME_KEY, s.filename);
}

function insertInto(sequence: SeqItem[], item: SeqItem, atStart: boolean, selectedSection: number): SeqItem[] {
  if (!sequence.length) return [item];
  const groups: number[] = [];
  let g = 0;
  for (const it of sequence) {
    groups.push(g);
    if (it.kind === "action" && it.actionId === "divider") g += 1;
  }
  const target = selectedSection >= 0 ? selectedSection : atStart ? 0 : groups[groups.length - 1]!;
  const indices = groups.map((gg, i) => (gg === target ? i : -1)).filter((i) => i >= 0);
  if (!indices.length) return atStart ? [item, ...sequence] : [...sequence, item];
  const first = indices[0]!;
  const last = indices[indices.length - 1]!;
  const lastItem = sequence[last];
  const insertAt = atStart
    ? first
    : lastItem && lastItem.kind === "action" && lastItem.actionId === "divider"
      ? last
      : last + 1;
  const next = sequence.slice();
  next.splice(insertAt, 0, item);
  return next;
}

export const useBoard = create<BoardState>((set, get) => ({
  sequence: [] as SeqItem[],
  settings: { ...DEFAULT_SETTINGS },
  filename: "sequence",
  unsaved: false,
  playing: false,
  hoverSound: null,
  hoverAction: null,
  selectedSection: -1,
  hiddenSections: [],
  bpm: DEFAULT_TEMPO,
  volumePct: DEFAULT_VOLUME,
  transpose: 0,
  bg: DEFAULT_BG,
  bgFade: 0.2,
  flash: 0,
  pulse: 0,
  bounce: {},
  pulseTick: {},
  placed: {},
  triggered: {},
  countdown: {},
  introIndex: 0,
  modal: null,
  editingUid: null,
  pendingStart: false,
  soundTargetId: null,
  hotbarTab: "sounds",
  recent: [],
  shift: false,
  alt: false,
  ctrl: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    set({
      sequence: loadSequence(),
      settings: loadSettings(),
      filename: localStorage.getItem(NAME_KEY) || "sequence",
    });
  },
  setKeys: (p) => set(p),
  setHoverSound: (v) => set({ hoverSound: v }),
  setHoverAction: (v) => set({ hoverAction: v }),
  setModal: (m) => set({ modal: m, editingUid: m ? get().editingUid : null }),
  setFilename: (n) => {
    const safe = n.replace(/[/\\:*?"<>|]/g, "");
    set({ filename: safe || "sequence", unsaved: true });
    persistAll(get);
  },
  persist: () => persistAll(get),
  addSound: (soundId, atStart) => {
    const item: SeqItem = { uid: uid(), kind: "sound", soundId, pitch: 0, volume: 100, pan: 0 };
    set((s) => ({
      sequence: insertInto(s.sequence, item, !!atStart || s.shift, s.selectedSection),
      unsaved: true,
    }));
    get().pushRecent(soundId);
    get().bumpPlaced(item.uid);
    persistAll(get);
  },
  addAction: (actionId, extra, atStart) => {
    const def = ACTION_MAP.get(actionId);
    const item: SeqItem = {
      uid: uid(),
      kind: "action",
      actionId,
      operator: "set",
      ...extra,
    };
    if (def?.isTarget && item.amount == null) {
      let n = 1;
      const seq = get().sequence;
      while (
        seq.some((x) => x.kind === "action" && x.actionId === "jump" && x.amount === n) &&
        seq.some((x) => x.kind === "action" && x.actionId === "target" && x.amount === n)
      )
        n++;
      item.amount = n;
    }
    const editing = get().editingUid;
    if (editing) {
      set((s) => ({
        sequence: s.sequence.map((it) => (it.uid === editing ? { ...it, ...item, uid: editing } : it)),
        unsaved: true,
        editingUid: null,
        modal: null,
      }));
    } else {
      set((s) => ({
        sequence: insertInto(s.sequence, item, !!atStart || s.shift, s.selectedSection),
        unsaved: true,
        modal: null,
      }));
    }
    get().pushRecent("." + actionId);
    get().bumpPlaced(editing || item.uid);
    persistAll(get);
  },
  removeAt: (id) => {
    set((s) => ({ sequence: s.sequence.filter((x) => x.uid !== id), unsaved: true }));
    persistAll(get);
  },
  duplicate: (id, toEnd) => {
    const s = get();
    const idx = s.sequence.findIndex((x) => x.uid === id);
    if (idx < 0) return;
    const copy: SeqItem = { ...s.sequence[idx]!, uid: uid() };
    const next = s.sequence.slice();
    if (toEnd) next.push(copy);
    else next.splice(idx + 1, 0, copy);
    set({ sequence: next, unsaved: true });
    get().bumpPlaced(copy.uid);
    persistAll(get);
  },
  moveItem: (from, to) => {
    set((s) => {
      if (from === to || from < 0 || to < 0 || from >= s.sequence.length) return s;
      const next = s.sequence.slice();
      const [it] = next.splice(from, 1);
      if (!it) return s;
      next.splice(Math.min(to, next.length), 0, it);
      return { sequence: next, unsaved: true };
    });
    persistAll(get);
  },
  updateItem: (id, patch) => {
    set((s) => ({
      sequence: s.sequence.map((it) => (it.uid === id ? ({ ...it, ...patch } as SeqItem) : it)),
      unsaved: true,
    }));
    persistAll(get);
  },
  clearAll: () => {
    set({
      sequence: [],
      unsaved: false,
      filename: "sequence",
      selectedSection: -1,
      hiddenSections: [],
      modal: null,
    });
    persistAll(get);
  },
  loadItems: (items, name) => {
    set({
      sequence: items,
      unsaved: false,
      filename: name || get().filename,
      selectedSection: -1,
    });
    persistAll(get);
  },
  setPlaying: (v) => set({ playing: v }),
  setPlayback: (p) => set(p),
  bumpBounce: (id) => set((s) => ({ bounce: { ...s.bounce, [id]: (s.bounce[id] || 0) + 1 } })),
  bumpPulse: (id) => set((s) => ({ pulseTick: { ...s.pulseTick, [id]: (s.pulseTick[id] || 0) + 1 } })),
  bumpPlaced: (id) => set((s) => ({ placed: { ...s.placed, [id]: (s.placed[id] || 0) + 1 } })),
  setTriggered: (id, v) => set((s) => ({ triggered: { ...s.triggered, [id]: v } })),
  clearAnim: (keep) =>
    keep
      ? set({
          playing: false,
          bpm: DEFAULT_TEMPO,
          volumePct: DEFAULT_VOLUME,
          transpose: 0,
          bg: DEFAULT_BG,
          flash: 0,
          pulse: 0,
        })
      : set({
          bounce: {},
          pulseTick: {},
          placed: {},
          triggered: {},
          countdown: {},
          flash: 0,
          pulse: 0,
          bpm: DEFAULT_TEMPO,
          volumePct: DEFAULT_VOLUME,
          transpose: 0,
          bg: DEFAULT_BG,
        }),
  setCountdown: (id, text) => set((s) => ({ countdown: { ...s.countdown, [id]: text } })),
  setBg: (color, fade) => set({ bg: color, bgFade: fade }),
  bumpFlash: () => set((s) => ({ flash: s.flash + 1 })),
  bumpScreenPulse: () => set((s) => ({ pulse: s.pulse + 1 })),
  cycleIntro: () => set((s) => ({ introIndex: (s.introIndex + 1) % 3 })),
  setSelectedSection: (n) => set({ selectedSection: n }),
  toggleSectionHidden: (n) =>
    set((s) => ({
      hiddenSections: s.hiddenSections.includes(n)
        ? s.hiddenSections.filter((x) => x !== n)
        : [...s.hiddenSections, n],
    })),
  patchSettings: (p) => {
    set((s) => ({ settings: { ...s.settings, ...p } }));
    persistAll(get);
  },
  setHotbarTab: (t) => set({ hotbarTab: t }),
  pushRecent: (id) =>
    set((s) => ({
      recent: [...s.recent.filter((x) => x !== id), id].slice(-48),
    })),
  setSoundTarget: (id) => set({ soundTargetId: id }),
  setEditing: (id) => set({ editingUid: id }),
}));

export function nextFreeTarget(seq: SeqItem[]) {
  let n = 1;
  while (
    seq.some((x) => x.kind === "action" && x.actionId === "jump" && x.amount === n) &&
    seq.some((x) => x.kind === "action" && x.actionId === "target" && x.amount === n)
  )
    n++;
  return n;
}

export { clamp };
