import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ACTION_MAP } from "@/lib/actions";
import { DEFAULT_BG } from "@/lib/types";
import { useBoard } from "@/lib/store";
import { cn } from "@/lib/utils";
import { GITHUB_PAGES, GITHUB_RELEASES, GITHUB_REPO } from "@/lib/site";
import { asset } from "@/lib/asset";
import { SoundTile } from "./tiles";

function Overlay({
  children,
  wide,
  onClose,
}: {
  children: ReactNode;
  wide?: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "max-h-[90vh] overflow-auto rounded-md bg-td-bg px-4 py-6 text-center shadow-2xl",
          wide ? "w-[min(800px,100%)]" : "w-[min(500px,100%)]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function NumberField({
  id,
  value,
  onChange,
  label,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div className="mt-5 flex items-center justify-center">
      <input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-[90px] rounded-md bg-black/50 text-center text-lg font-bold text-white outline-none"
      />
      {label ? <p className="mb-0 ml-2.5 text-lg text-white">{label}</p> : null}
    </div>
  );
}

function BlueBtn({
  children,
  onClick,
  green,
  red,
  gray,
  ...rest
}: {
  children: ReactNode;
  onClick: () => void;
  green?: boolean;
  red?: boolean;
  gray?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mx-1.5 h-10 min-w-[100px] rounded-md px-4 text-lg font-bold text-white transition-transform hover:scale-105 active:scale-110",
        green ? "bg-td-green" : red ? "bg-td-red" : gray ? "bg-[#777]" : "bg-td-blue",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Dialogs() {
  const modal = useBoard((s) => s.modal);
  const setModal = useBoard((s) => s.setModal);
  const addAction = useBoard((s) => s.addAction);
  const clearAll = useBoard((s) => s.clearAll);
  const settings = useBoard((s) => s.settings);
  const patchSettings = useBoard((s) => s.patchSettings);
  const shift = useBoard((s) => s.shift);

  const [speed, setSpeed] = useState("300");
  const [vol, setVol] = useState("100");
  const [pause, setPause] = useState("4");
  const [loops, setLoops] = useState("4");
  const [trans, setTrans] = useState("1");
  const [pulses, setPulses] = useState("1");
  const [freq, setFreq] = useState("2");
  const [bgHex, setBgHex] = useState("36393c");
  const [fade, setFade] = useState("0.5");
  const [help, setHelp] = useState("");
  const editingUid = useBoard((s) => s.editingUid);
  const sequence = useBoard((s) => s.sequence);

  useEffect(() => {
    if (!modal) return;
    if (editingUid) {
      const item = sequence.find((x) => x.uid === editingUid);
      if (item?.kind === "action") {
        if (item.amount != null) {
          const v = String(item.amount);
          if (modal.type === "speed") setSpeed(v);
          if (modal.type === "volume") setVol(v);
          if (modal.type === "stop") setPause(v);
          if (modal.type === "loopmany") setLoops(v);
          if (modal.type === "transpose") setTrans(v);
        }
        if (item.val1 != null) {
          if (modal.type === "pulse") {
            setPulses(String(item.val1));
            setFreq(String(item.val2 ?? 2));
          }
          if (modal.type === "bg") {
            setBgHex(String(item.val1).replace("#", ""));
            setFade(String(item.val2 ?? 0.5));
          }
        }
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Enter") {
        const btn = document.querySelector<HTMLButtonElement>("[data-confirm]");
        btn?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, setModal, editingUid, sequence]);

  if (!modal) return null;
  const close = () => setModal(null);

  if (modal.type === "speed") {
    return (
      <Overlay onClose={close}>
        <h1 className="text-2xl font-bold text-white">Set Tempo</h1>
        <p className="mx-auto mt-1 max-w-[400px] text-white/90">Sets the speed of the entire sequence, in beats per minute. Default is 300.</p>
        <p className="mt-2 text-sm text-white/50">right click an action to skip this popup</p>
        <NumberField id="speed" value={speed} onChange={setSpeed} label="BPM" />
        <div className="mt-6">
          <BlueBtn onClick={() => addAction("speed", { amount: Number(speed), operator: "set" })}>Set to</BlueBtn>
          <BlueBtn green onClick={() => addAction("speed", { amount: Number(speed), operator: "add" })}>Add</BlueBtn>
          <BlueBtn green onClick={() => addAction("speed", { amount: Number(speed), operator: shift ? "divide" : "multiply" })}>
            Multiply
          </BlueBtn>
        </div>
      </Overlay>
    );
  }

  if (modal.type === "volume") {
    return (
      <Overlay onClose={close}>
        <h1 className="text-2xl font-bold text-white">Set Volume</h1>
        <p className="mx-auto mt-1 max-w-[400px] text-white/90">Sets the volume of all following sounds.</p>
        <NumberField id="vol" value={vol} onChange={setVol} label="%" />
        <div className="mt-6">
          <BlueBtn onClick={() => addAction("volume", { amount: Number(vol), operator: "set" })}>Set to</BlueBtn>
          <BlueBtn green onClick={() => addAction("volume", { amount: Number(vol), operator: "add" })}>Add</BlueBtn>
          <BlueBtn green onClick={() => addAction("volume", { amount: Number(vol), operator: shift ? "divide" : "multiply" })}>
            Multiply
          </BlueBtn>
        </div>
      </Overlay>
    );
  }

  if (modal.type === "stop") {
    return (
      <Overlay onClose={close}>
        <h1 className="text-2xl font-bold text-white">Pause</h1>
        <p className="mx-auto mt-1 max-w-[400px] text-white/90">Wait a number of beats before continuing.</p>
        <NumberField id="pause" value={pause} onChange={setPause} label="beats" />
        <div className="mt-6">
          <BlueBtn data-confirm="" onClick={() => addAction("stop", { amount: Number(pause), operator: "set" })}>
            OK
          </BlueBtn>
        </div>
      </Overlay>
    );
  }

  if (modal.type === "loopmany") {
    return (
      <Overlay onClose={close}>
        <h1 className="text-2xl font-bold text-white">Loop</h1>
        <p className="mx-auto mt-1 max-w-[400px] text-white/90">
          Loop a specified number of times. Returns to the start if no start point is set.
        </p>
        <NumberField id="loops" value={loops} onChange={setLoops} label="loops" />
        <div className="mt-6">
          <BlueBtn data-confirm="" onClick={() => addAction("loopmany", { amount: Number(loops), operator: "set" })}>
            OK
          </BlueBtn>
        </div>
      </Overlay>
    );
  }

  if (modal.type === "transpose") {
    return (
      <Overlay onClose={close}>
        <h1 className="text-2xl font-bold text-white">Transpose</h1>
        <p className="mx-auto mt-1 max-w-[400px] text-white/90">Raises or lowers the pitch of all following sounds.</p>
        <NumberField id="trans" value={trans} onChange={setTrans} label="semitones" />
        <div className="mt-6">
          <BlueBtn onClick={() => addAction("transpose", { amount: Number(trans), operator: "set" })}>Set to</BlueBtn>
          <BlueBtn green onClick={() => addAction("transpose", { amount: Number(trans), operator: "add" })}>Add</BlueBtn>
        </div>
      </Overlay>
    );
  }

  if (modal.type === "pulse") {
    return (
      <Overlay onClose={close}>
        <h1 className="text-2xl font-bold text-white">Pulse</h1>
        <p className="mx-auto mt-1 max-w-[400px] text-white/90">Pulses the screen a certain number of times.</p>
        <div className="mt-4 flex items-center justify-center">
          <p className="mb-0 mr-3 w-[100px] text-right text-white">Pulses:</p>
          <input className="h-10 w-[90px] rounded-md bg-black/50 text-center text-lg font-bold text-white" value={pulses} onChange={(e) => setPulses(e.target.value)} />
          <p className="mb-0 ml-2 text-white">(total)</p>
        </div>
        <div className="mt-3 flex items-center justify-center">
          <p className="mb-0 mr-3 w-[100px] text-right text-white">Frequency:</p>
          <input className="h-10 w-[90px] rounded-md bg-black/50 text-center text-lg font-bold text-white" value={freq} onChange={(e) => setFreq(e.target.value)} />
          <p className="mb-0 ml-2 text-white">(every X beats)</p>
        </div>
        <div className="mt-6">
          <BlueBtn green data-confirm="" onClick={() => addAction("pulse", { val1: Number(pulses), val2: Number(freq) })}>
            Add
          </BlueBtn>
        </div>
      </Overlay>
    );
  }

  if (modal.type === "bg") {
    const color = `#${bgHex}`;
    return (
      <Overlay onClose={close}>
        <h1 className="text-2xl font-bold text-white">Background Color</h1>
        <p className="mx-auto mt-1 max-w-[400px] text-white/90">Sets the page background color.</p>
        <div className="mt-5 flex items-center justify-center">
          <p className="mb-0 mr-1.5 text-white">#</p>
          <input
            className="h-10 w-[90px] rounded-md bg-black/50 text-center text-lg uppercase text-white"
            maxLength={6}
            value={bgHex}
            onChange={(e) => setBgHex(e.target.value.replace(/[^a-f0-9]/gi, "").slice(0, 6))}
          />
          <label
            className="ml-3 size-[38px] cursor-pointer rounded-md border-2 border-black"
            style={{ background: /^#[a-f0-9]{6}$/i.test(color) ? color : DEFAULT_BG }}
          >
            <input
              type="color"
              className="sr-only"
              value={/^#[a-f0-9]{6}$/i.test(color) ? color : DEFAULT_BG}
              onChange={(e) => setBgHex(e.target.value.slice(1))}
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-center">
          <p className="mb-0 mr-3 w-[100px] text-right text-white">Fade time:</p>
          <input className="h-10 w-[90px] rounded-md bg-black/50 text-center text-lg font-bold text-white" value={fade} onChange={(e) => setFade(e.target.value)} />
          <p className="mb-0 ml-2 text-white">secs</p>
        </div>
        <div className="mt-6">
          <BlueBtn red onClick={() => setBgHex("36393c")}>Reset</BlueBtn>
          <BlueBtn green data-confirm="" onClick={() => addAction("bg", { val1: /^#[a-f0-9]{6}$/i.test(color) ? color : DEFAULT_BG, val2: Number(fade) })}>
            Add
          </BlueBtn>
        </div>
      </Overlay>
    );
  }

  if (modal.type === "clear") {
    return (
      <Overlay onClose={close}>
        <h1 className="text-2xl font-bold text-white">Clear all sounds?</h1>
        <p className="mt-1 text-white/90">
          Surprisingly, this can't be undone.
          <span className="hidden sm:inline">
            <br />
            (hold shift to skip this popup)
          </span>
        </p>
        <div className="mt-6">
          <BlueBtn gray onClick={close}>Back</BlueBtn>
          <BlueBtn red onClick={() => { clearAll(); }}>Clear!</BlueBtn>
        </div>
      </Overlay>
    );
  }

  if (modal.type === "settings") {
    const rows: { key: keyof typeof settings; label: string; help: string; invert?: boolean }[] = [
      { key: "actionShortcuts", label: "Action shortcuts", help: "Place actions using single-key shortcuts", invert: false },
      { key: "autoScroll", label: "Auto-scroll", help: "Automatically scrolls the screen during playback" },
      { key: "pinSectionButtons", label: "Pin section controls", help: "Pins the section buttons to the bottom of the screen" },
      { key: "exitConfirmation", label: "Exit confirmation", help: "Warn when leaving with unsaved changes" },
      { key: "noAnimations", label: "Disable Animations", help: "Disables bouncing, pulsing, flashing. Enable if playback is lagging" },
      { key: "invertPanning", label: "Invert Panning", help: "Inverts stereo channels" },
      { key: "altExtension", label: "Alt file extension", help: "Uses .moai instead of .🗿 when saving" },
    ];
    return (
      <Overlay onClose={close}>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="h-9 text-white/50">{help || "(hover over a setting for information)"}</p>
        <div className="mt-2 flex flex-wrap justify-between gap-y-1 px-6">
          {rows.map((r) => (
            <label
              key={r.key}
              className="flex w-[200px] cursor-pointer items-center gap-2 hover:underline hover:decoration-dotted"
              onMouseEnter={() => setHelp(r.help)}
              onMouseLeave={() => setHelp("")}
            >
              <input
                type="checkbox"
                className="size-6 accent-td-blue"
                checked={!!settings[r.key]}
                onChange={(e) => patchSettings({ [r.key]: e.target.checked })}
              />
              <span className="text-white">{r.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-6">
          <BlueBtn onClick={close}>Done</BlueBtn>
        </div>
      </Overlay>
    );
  }

  if (modal.type === "shortcuts") {
    const groups = [
      { title: "Sound list", lines: ["Left click: Place sound", "Shift + left click: Place sound at start", "Right click: Preview sound"] },
      { title: "Action list", lines: ["Left click: Place action", "Right click: Place action, skip popups", "Shift + left click: Place action at start"] },
      {
        title: "Sequence",
        lines: [
          "Left click: Remove icon",
          "Right click: Preview sound",
          "Drag: Move icon",
          "Shift + left click: Duplicate",
          "Scroll: Adjust pitch or action",
          "Ctrl + scroll: Adjust volume",
          "Ctrl + left/right: Adjust panning",
          "Shift + scroll: Larger adjust",
          "Alt + scroll: Smaller adjust",
        ],
      },
      {
        title: "Global",
        lines: [
          "Space/enter: Play/stop",
          "Esc: Close popup",
          "Ctrl + S: Save",
          "Ctrl + O: Load",
          "Ctrl + P: Toggle pro mode",
          "Shift + /: Settings",
          "Ctrl + /: Shortcuts",
        ],
      },
    ];
    return (
      <Overlay wide onClose={close}>
        <h1 className="mb-6 text-2xl font-bold text-white">Keyboard Shortcuts</h1>
        <div className="grid gap-6 rounded-xl bg-black/20 p-6 text-left sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-2 font-bold text-white underline">{g.title}</p>
              {g.lines.map((l) => (
                <p key={l} className="mb-1 text-white">
                  <b>{l.split(":")[0]}:</b> {l.split(":").slice(1).join(":")}
                </p>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-6">
          <BlueBtn onClick={close}>Done</BlueBtn>
        </div>
      </Overlay>
    );
  }

  if (modal.type === "tips") {
    return (
      <Overlay wide onClose={close}>
        <h1 className="mb-6 text-2xl font-bold text-white">Pro tips!</h1>
        <div className="mx-auto flex max-w-[700px] flex-col gap-5">
          {[
            { id: "boom", title: "Volume adjustment", body: "Hold Ctrl and scroll to change the volume of a sound", extra: "25%" },
            { id: "boom", title: "Pan adjustment", body: "Hold Ctrl and press left or right to pan a sound", extra: "◂7.5" },
            { id: "boom", title: "Fine adjustment", body: "Hold Alt while scrolling for finer adjustment, and Shift for stronger", extra: "+7.2" },
            { id: "boom", title: "Add at the start", body: "Hold Shift while placing a sound or action to insert it at the beginning", extra: "" },
            { id: "_pause", title: "Combine sounds", body: "Place a Combine action after a sound so the next one plays at the same time", extra: "" },
            { id: "boom", title: "Skip the intro", body: "Right click Play (or hold it on mobile) to skip the lecture", extra: "" },
          ].map((t) => (
            <div key={t.title} className="flex items-center gap-8 rounded-xl bg-black/20 px-5 py-4 text-left">
              <div className="relative">
                <SoundTile soundId={t.id} />
                <span className="absolute bottom-0 w-full text-center text-xs font-bold text-white [text-shadow:0_0_4px_black]">
                  {t.extra}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{t.title}</h2>
                <p className="mt-2 mb-0 text-white">{t.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <BlueBtn onClick={close}>Done</BlueBtn>
        </div>
      </Overlay>
    );
  }

  if (modal.type === "install") {
    return (
      <Overlay onClose={close}>
        <h1 className="text-2xl font-bold text-white">Install this app</h1>
        <p className="popupdesc">
          Download a real installer from GitHub Releases, or install the live page as a PWA. Icon is the moai from the original site.
        </p>
        <div className="install-os">
          <h2>Android</h2>
          <p>
            Get <b>ThirtyDollarWebsite.apk</b> from{" "}
            <a href={GITHUB_RELEASES} target="_blank" rel="noreferrer">
              Releases
            </a>
            , allow unknown sources, then open the file. Or Chrome → Add to Home screen.
          </p>
          <h2>Windows</h2>
          <p>
            Run the <b>.exe</b> setup (or the portable exe) from Releases. SmartScreen may warn because it is unsigned — More info → Run anyway.
          </p>
          <h2>macOS</h2>
          <p>
            Open the <b>.dmg</b>, drag the app to Applications, then right-click → Open the first time (unsigned).
          </p>
          <h2>Linux</h2>
          <p>
            Download the <b>.AppImage</b>, <code>chmod +x</code> it, then run it.
          </p>
          <h2>iPhone / iPad</h2>
          <p>Safari → Share → Add to Home Screen (Apple does not allow sideload IPAs here).</p>
        </div>
        <p className="mx-auto mt-4 max-w-[400px] text-sm text-white/70">
          Live PWA:{" "}
          <a href={GITHUB_PAGES} target="_blank" rel="noreferrer">
            GitHub Pages
          </a>
          <br />
          APK / EXE / DMG / AppImage:{" "}
          <a href={GITHUB_RELEASES} target="_blank" rel="noreferrer">
            GitHub Releases
          </a>
        </p>
        <div className="mt-6">
          <BlueBtn onClick={close}>Done</BlueBtn>
        </div>
      </Overlay>
    );
  }

  return null;
}

export function HelpButtons() {
  const setModal = useBoard((s) => s.setModal);
  return (
    <div className="bottomSection helpButtons">
      <button type="button" className="nomobile" onClick={() => setModal({ type: "shortcuts" })}>
        <img src={asset("assets/keyboard.svg")} alt="" />
        <b>Shortcuts</b>
      </button>
      <button type="button" onClick={() => setModal({ type: "settings" })}>
        <img src={asset("assets/cog.svg")} alt="" />
        <b>Settings</b>
      </button>
      <button type="button" className="nomobile" onClick={() => setModal({ type: "tips" })}>
        <img src={asset("assets/bulb.svg")} alt="" />
        <b>Pro tips!</b>
      </button>
      <InstallButton />
      <a className="githubBtn" href={GITHUB_REPO} target="_blank" rel="noreferrer">
        <img src={asset("assets/social_github.svg")} alt="" />
        <b>GitHub</b>
      </a>
    </div>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function InstallButton() {
  const setModal = useBoard((s) => s.setModal);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (standalone) setInstalled(true);
    const onBip = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  return (
    <button
      type="button"
      className="installBtn"
      onClick={async () => {
        if (promptEvent) {
          await promptEvent.prompt();
          const choice = await promptEvent.userChoice;
          if (choice.outcome === "accepted") setInstalled(true);
          setPromptEvent(null);
          return;
        }
        setModal({ type: "install" });
      }}
    >
      <img src={asset("assets/download.svg")} alt="" />
      <b>Install</b>
    </button>
  );
}

void ACTION_MAP;
