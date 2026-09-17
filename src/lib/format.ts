import { ACTIONS, ACTION_MAP, prefixFor } from "./actions";
import { exportSoundId, getSound } from "./sounds";
import type { ActionId, SeqAction, SeqItem, SeqSound } from "./types";
import { uid } from "./utils";

export function serializeSequence(items: SeqItem[]): string {
  const packed: [string, number][] = [];
  for (const it of items) {
    let token = "";
    if (it.kind === "sound") {
      const def = getSound(it.soundId);
      token = def ? exportSoundId(def) : it.soundId;
      if (it.pitch) token += `@${it.pitch}`;
      if (it.volume !== 100) token += `%${it.volume}`;
      if (it.pan) token += `^${it.pan}`;
    } else {
      token = "!" + it.actionId;
      if (it.actionId === "divider") token += "\n";
      else if (it.val1 != null && it.val2 != null) token += `@${it.val1},${it.val2}`;
      else if (it.soundTarget) token += `@${it.soundTarget}`;
      else if (it.amount != null) {
        token += `@${it.amount}`;
        if (it.operator === "add") token += "@+";
        else if (it.operator === "multiply") token += "@x";
        else if (it.operator === "divide") token += "@/";
      }
    }
    const last = packed[packed.length - 1];
    if (last && last[0] === token) last[1] += 1;
    else packed.push([token, 1]);
  }
  return packed.map(([t, n]) => `${t}${n > 1 ? "=" + n : ""}`).join("|");
}

export function parseSequence(data: string): SeqItem[] {
  const items: SeqItem[] = [];
  const chunks = (data || "").replace(/\s/g, "").split("|");
  for (const chunk of chunks) {
    if (!chunk) continue;
    const [raw, countStr] = chunk.split("=");
    const count = Math.max(1, Number(countStr) || 1);
    if (!raw) continue;
    const piece = buildOne(raw);
    if (!piece) continue;
    for (let i = 0; i < count; i++) items.push(cloneItem(piece));
  }
  return items;
}

function cloneItem(it: SeqItem): SeqItem {
  return { ...it, uid: uid() };
}

function buildOne(data: string): SeqItem | null {
  if (data.startsWith("!")) {
    const [mainRaw, param, num] = data.slice(1).split("@");
    const main = (mainRaw || "").replace(/\n/g, "") as ActionId;
    const def = ACTION_MAP.get(main);
    if (!def) return null;
    const action: SeqAction = { uid: uid(), kind: "action", actionId: main };
    if (def.twoValues && param) {
      const [a, b] = param.split(",");
      action.val1 = def.colorMode ? a : Number(a);
      action.val2 = Number(b);
    } else if ((def.amount || def.isTarget) && param) {
      action.amount = Number(param);
      if (num === "x") action.operator = "multiply";
      else if (num === "/") action.operator = "divide";
      else if (num === "+") action.operator = "add";
      else action.operator = "set";
    } else if (def.soundTarget && param) {
      action.soundTarget = param;
    } else if (def.isTarget) {
      action.amount = 1;
    }
    return action;
  }

  const splitter = data.search(/[@%^]/);
  const id = splitter === -1 ? data : data.slice(0, splitter);
  const found = getSound(id);
  if (!id) return null;
  const sound: SeqSound = {
    uid: uid(),
    kind: "sound",
    soundId: found?.id ?? id,
    pitch: 0,
    volume: 100,
    pan: 0,
  };
  if (splitter !== -1) {
    const params = data.slice(splitter).split(/(?=[@%^])/);
    for (const p of params) {
      if (p.startsWith("@")) sound.pitch = Number(p.slice(1)) || 0;
      else if (p.startsWith("%")) sound.volume = Number(p.slice(1)) || 100;
      else if (p.startsWith("^")) sound.pan = Number(p.slice(1)) || 0;
    }
  }
  return sound;
}

export function actionLabel(it: SeqAction): string {
  const def = ACTION_MAP.get(it.actionId);
  if (!def) return "";
  if (it.val1 != null && it.val2 != null) {
    if (def.colorMode) return `${it.val2}`;
    return `${it.val1}, ${it.val2}`;
  }
  if (it.amount == null) return "";
  const op = it.operator ?? "set";
  const bounds = def[op] ?? def.set;
  const suffix = bounds?.[3] ?? def.unit ?? "";
  return `${prefixFor(op, it.amount)}${it.amount}${suffix}`;
}

export const DEMO_SEQUENCE =
  "!speed@180|boom|👏|boom|🥁|boom|👏|🥁|👏|!combine|shaker|🔔@7|🔔@12|🔔@16|boom|!stop@2|🎉|!flash";

export { ACTIONS };
