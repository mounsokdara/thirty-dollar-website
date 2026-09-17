import type { ActionDef } from "./types";

export const ACTIONS: ActionDef[] = [
  {
    id: "speed",
    name: "Set tempo",
    shortcut: "t",
    amount: true,
    defaultAmount: 300,
    set: [10, 10000],
    add: [-10000, 10000],
    multiply: [0.01, 1000, 0.1],
    divide: [0.1, 100, 0.1],
  },
  {
    id: "volume",
    name: "Set volume",
    shortcut: "v",
    amount: true,
    defaultAmount: 100,
    set: [0, 600, 1, "%"],
    add: [-600, 600, 1, "%"],
    multiply: [0.01, 1000, 0.1],
    divide: [0.1, 100, 0.1],
    unit: "%",
  },
  {
    id: "stop",
    name: "Pause for duration",
    shortcut: "p",
    amount: true,
    defaultAmount: 4,
    set: [0, 1000],
  },
  {
    id: "transpose",
    name: "Transpose",
    shortcut: "m",
    amount: true,
    defaultAmount: 1,
    set: [-60, 60],
    add: [-60, 60],
  },
  {
    id: "loopmany",
    name: "Loop",
    shortcut: "l",
    amount: true,
    defaultAmount: 4,
    set: [1, 1000],
  },
  { id: "loop", name: "Loop once", shortcut: "r" },
  { id: "looptarget", name: "Set loop start point", shortcut: "s" },
  { id: "combine", name: "Combine sounds", shortcut: "c" },
  { id: "jump", name: "Go to target", shortcut: "g", isTarget: true, set: [1, 9999] },
  { id: "target", name: "Target", shortcut: "a", isTarget: true, set: [1, 9999] },
  { id: "cut", name: "Stop all sounds", shortcut: "x", soundTarget: true },
  { id: "startpos", name: "Set start position", shortcut: "o" },
  { id: "divider", name: "Add divider", shortcut: "d" },
  { id: "flash", name: "Flash screen", shortcut: "f" },
  {
    id: "pulse",
    name: "Pulse screen",
    shortcut: "u",
    amount: true,
    twoValues: true,
    defaultPair: [1, 2],
  },
  {
    id: "bg",
    name: "Set background color",
    shortcut: "b",
    amount: true,
    twoValues: true,
    colorMode: true,
    defaultPair: ["#36393c", 1],
  },
];

export const ACTION_MAP = new Map(ACTIONS.map((a) => [a.id, a]));

export function prefixFor(op: string | undefined, amount: number) {
  if (op === "add") return "+";
  if (op === "multiply") return "⨯";
  if (op === "divide") return "/";
  if (op === "plus") return amount >= 0 ? "+" : "";
  return "";
}
