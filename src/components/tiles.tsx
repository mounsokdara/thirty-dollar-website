import type { ActionId } from "@/lib/types";
import { getSound } from "@/lib/sounds";
import { asset } from "@/lib/asset";
import { cn } from "@/lib/utils";

export function SoundTile({
  soundId,
  size = 56,
  className,
  triggered,
}: {
  soundId: string;
  size?: number;
  className?: string;
  triggered?: boolean;
}) {
  const sound = getSound(soundId);
  if (sound?.emoji) {
    return (
      <span
        className={cn("td-emoji", triggered ? "triggered" : "", className)}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.72) }}
        role="img"
        aria-label={sound.name}
      >
        {sound.emoji}
      </span>
    );
  }
  const src = sound?.image ?? asset("assets/empty.png");
  return (
    <img
      alt={sound?.name ?? soundId}
      src={src}
      draggable={false}
      className={cn(triggered ? "triggered" : "", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function ActionTile({
  actionId,
  size = 56,
  className,
  triggered,
}: {
  actionId: ActionId;
  size?: number;
  className?: string;
  triggered?: boolean;
}) {
  return (
    <img
      alt={actionId}
      src={asset(`assets/action_${actionId}.png`)}
      draggable={false}
      className={cn(triggered ? "triggered" : "", className)}
      style={{ width: size, height: size }}
    />
  );
}
