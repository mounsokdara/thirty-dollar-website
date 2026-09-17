import { createFileRoute } from "@tanstack/react-router";
import { Soundboard } from "@/components/soundboard";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <Soundboard />;
}
