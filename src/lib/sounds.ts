import catalog from "./sounds.json";
import type { SoundDef, SoundTag } from "./types";
import { asset } from "./asset";

type RawSound = {
  id: string;
  name: string;
  source?: string;
  tags?: string[];
  emoji?: string;
  img?: string;
  useID?: boolean;
};

function imageFor(s: RawSound): string {
  if (s.id === "_pause") return asset("assets/empty.png");
  if (!s.emoji && /[a-z0-9]/i.test(s.id)) return asset(`icons/${s.img || s.id}.png`);
  const ch = s.emoji || s.id;
  const pts: string[] = [];
  for (const c of ch) {
    const cp = c.codePointAt(0);
    if (cp == null || cp === 0xfe0f) continue;
    pts.push(cp.toString(16));
  }
  return asset(`twemoji/${pts.join("-")}.svg`);
}

export const SOUNDS: SoundDef[] = (catalog as RawSound[]).map((s) => ({
  id: s.id,
  name: s.name,
  source: s.source || "",
  tags: (s.tags || []) as SoundTag[],
  emoji: s.emoji,
  img: s.img,
  useID: s.useID,
  image: imageFor(s),
}));

export const SOUND_MAP = new Map<string, SoundDef>();
for (const s of SOUNDS) {
  SOUND_MAP.set(s.id, s);
  if (s.emoji) SOUND_MAP.set(s.emoji, s);
}

export function getSound(id: string | undefined | null) {
  if (!id) return undefined;
  return SOUND_MAP.get(id);
}

export function exportSoundId(sound: SoundDef) {
  return sound.useID ? sound.id : sound.emoji || sound.id;
}

export function soundFileUrl(id: string) {
  return asset(`sounds/${encodeURIComponent(id)}.wav`);
}
