import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function semitonesToRate(semitones: number) {
  return Math.pow(2, Number(semitones) / 12);
}

export function formatPitch(p: number) {
  const n = Number(p.toFixed(2));
  if (n === 0) return "";
  return n > 0 ? `+${n}` : `${n}`;
}

export function formatPan(p: number) {
  if (!p) return "";
  const mag = Math.abs(Math.round(p) / 10);
  return p < 0 ? `◂${mag}` : `${mag}▸`;
}
