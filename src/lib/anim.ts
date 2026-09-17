import { useLayoutEffect, type RefObject } from "react";

/** Restart a CSS animation class the same way the original jQuery `runAnimation` does. */
export function runAnimation(el: HTMLElement | null | undefined, className: string) {
  if (!el) return;
  el.style.animation = "none";
  void el.offsetHeight;
  el.style.animation = "";
  el.classList.remove(className);
  void el.offsetHeight;
  el.classList.add(className);
}

export function useRunAnimation(
  ref: RefObject<HTMLElement | null>,
  className: string,
  token: number,
  enabled = true,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!enabled || !token) {
      el.classList.remove(className);
      return;
    }
    runAnimation(el, className);
  }, [ref, className, token, enabled]);
}
