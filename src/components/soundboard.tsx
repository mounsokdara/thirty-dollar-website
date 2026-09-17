import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ACTIONS, ACTION_MAP } from "@/lib/actions";
import { playIntro, playSound, preloadIds, stopIntro, stopSounds, unlockAudio, semitonesToRate } from "@/lib/audio";
import { actionLabel, parseSequence, serializeSequence } from "@/lib/format";
import { compileSequence, runCompiled } from "@/lib/player";
import { SOUNDS, getSound } from "@/lib/sounds";
import { useBoard } from "@/lib/store";
import type { ActionId, SeqItem, SeqSound } from "@/lib/types";
import { DEFAULT_TEMPO, DEFAULT_VOLUME } from "@/lib/types";
import { clamp, cn, formatPan, formatPitch } from "@/lib/utils";
import { GITHUB_REPO, ORIGINAL_SITE } from "@/lib/site";
import { asset } from "@/lib/asset";
import { runAnimation, useRunAnimation } from "@/lib/anim";
import { Dialogs, HelpButtons } from "./dialogs";
import { ActionTile, SoundTile } from "./tiles";

const INTROS = [
  "DON'T YOU LECTURE ME WITH YOUR THIRTY DOLLAR WEBSITE",
  "how you gonna talk behind my back when you deadass built like a",
  "white people be like",
];

const HOTBAR_TABS = ["sounds", "actions", "recent", "notes", "percussion"] as const;

let hoverSeqUid: string | null = null;
let dragUid: string | null = null;
let dragClone = false;
let stopEngine: (cut?: boolean) => void = () => {};
let livePlaying = false;

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|Mobile/i.test(navigator.userAgent) || window.innerWidth < 700;
}

function haltPlayback(opts?: { stop?: boolean; keepAnim?: boolean }) {
  const wasPlaying = livePlaying;
  livePlaying = false;
  // Match original cancel(): only cut voices when Stop is explicit, or when
  // cancelling an active sequence without keepAnimations. Natural end uses
  // { keepAnim: true } and lets samples ring out.
  const cut = Boolean(opts?.stop) || (!opts?.keepAnim && wasPlaying);
  stopEngine(cut);
  stopEngine = () => {};
  stopIntro();
  if (cut) stopSounds();
  useBoard.getState().setPlaying(false);
  useBoard.getState().clearAnim(opts?.keepAnim);
}

export function Soundboard() {
  const sequence = useBoard((s) => s.sequence);
  const settings = useBoard((s) => s.settings);
  const playing = useBoard((s) => s.playing);
  const bg = useBoard((s) => s.bg);
  const bgFade = useBoard((s) => s.bgFade);
  const flash = useBoard((s) => s.flash);
  const pulse = useBoard((s) => s.pulse);
  const introIndex = useBoard((s) => s.introIndex);
  const filename = useBoard((s) => s.filename);
  const selectedSection = useBoard((s) => s.selectedSection);
  const hiddenSections = useBoard((s) => s.hiddenSections);
  const bpm = useBoard((s) => s.bpm);
  const volumePct = useBoard((s) => s.volumePct);
  const transpose = useBoard((s) => s.transpose);
  const unsaved = useBoard((s) => s.unsaved);
  const proMode = settings.proMode;

  const setPlaying = useBoard((s) => s.setPlaying);
  const cycleIntro = useBoard((s) => s.cycleIntro);
  const setFilename = useBoard((s) => s.setFilename);
  const setModal = useBoard((s) => s.setModal);
  const patchSettings = useBoard((s) => s.patchSettings);
  const loadItems = useBoard((s) => s.loadItems);
  const shift = useBoard((s) => s.shift);

  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(false);
  const [arming, setArming] = useState(false);
  const [draggingFile, setDraggingFile] = useState(false);

  useEffect(() => {
    useBoard.getState().hydrate();
    setMobile(isMobile());
    const vis = () => {
      if (document.visibilityState === "visible") unlockAudio();
    };
    const onResize = () => setMobile(isMobile());
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("resize", onResize);
    if (
      !import.meta.env.DEV &&
      "serviceWorker" in navigator &&
      (window.location.protocol === "http:" || window.location.protocol === "https:")
    ) {
      const base = import.meta.env.BASE_URL.endsWith("/")
        ? import.meta.env.BASE_URL
        : `${import.meta.env.BASE_URL}/`;
      void navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
    }
    return () => {
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      useBoard.setState({ shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey });
    };
    const up = (e: KeyboardEvent) => {
      useBoard.setState({ shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", () => useBoard.setState({ shift: false, alt: false, ctrl: false }));
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      const s = useBoard.getState();
      if (s.settings.exitConfirmation && s.unsaved && s.sequence.length) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, []);

  const begin = useCallback(() => {
    const state = useBoard.getState();
    if (!state.sequence.length || !livePlaying) return;
    const compiled = compileSequence(state.sequence, { selectedSection: state.selectedSection });
    stopEngine = runCompiled(compiled, {
      invertPan: state.settings.invertPanning,
      noAnimations: state.settings.noAnimations,
      autoScroll: state.settings.autoScroll,
      onBounce: (uid) => useBoard.getState().bumpBounce(uid),
      onPulse: (uid) => useBoard.getState().bumpPulse(uid),
      onTrigger: (uid) => useBoard.getState().setTriggered(uid, true),
      onUntrigger: (indices) => {
        const seq = useBoard.getState().sequence;
        indices.forEach((i) => {
          const it = seq[i];
          if (it) useBoard.getState().setTriggered(it.uid, false);
        });
      },
      onTempo: (v) => useBoard.getState().setPlayback({ bpm: v }),
      onVolume: (v) => useBoard.getState().setPlayback({ volumePct: v }),
      onTranspose: (v) => useBoard.getState().setPlayback({ transpose: v }),
      onCountdown: (uid, text) => useBoard.getState().setCountdown(uid, text),
      onFlash: () => useBoard.getState().bumpFlash(),
      onScreenPulse: () => useBoard.getState().bumpScreenPulse(),
      onBg: (c, f) => useBoard.getState().setBg(c, f),
      onScrollTo: (uid) => {
        const el = document.querySelector(`[data-uid="${uid}"]`);
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      },
      onDone: () => haltPlayback({ keepAnim: true }),
      shouldStop: () => !livePlaying,
    });
  }, []);

  const start = useCallback(
    async (skipIntro = false) => {
      const state = useBoard.getState();
      if (livePlaying || arming || !state.sequence.length) return;
      unlockAudio();
      haltPlayback({ stop: true });
      livePlaying = true;
      setPlaying(true);
      useBoard.getState().setPlayback({ bpm: DEFAULT_TEMPO, volumePct: DEFAULT_VOLUME, transpose: 0 });
      setArming(true);
      const ids = state.sequence.filter((x): x is SeqSound => x.kind === "sound").map((x) => x.soundId);
      try {
        await preloadIds(ids);
      } catch {
        /* play what we have */
      }
      setArming(false);
      if (!livePlaying) return;
      useBoard.setState({ placed: {}, bounce: {}, pulseTick: {}, triggered: {} });
      if (!skipIntro && state.selectedSection < 0) {
        playIntro(state.introIndex, () => {
          if (livePlaying) begin();
        });
      } else {
        begin();
      }
    },
    [arming, begin, setPlaying],
  );

  const saveFile = useCallback(async (as = false) => {
    const data = serializeSequence(useBoard.getState().sequence);
    if (!data) return;
    const ext = useBoard.getState().settings.altExtension ? ".moai" : ".🗿";
    const name = (useBoard.getState().filename || "sequence") + ext;
    const blob = new Blob([data], { type: "text/plain;charset=UTF-8" });
    const picker = (window as Window & { showSaveFilePicker?: (o: { suggestedName: string }) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker;
    if (as && typeof picker === "function") {
      try {
        const handle = await picker({ suggestedName: name });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        useBoard.setState({ unsaved: false });
        return;
      } catch {
        return;
      }
    }
    if (as) nameRef.current?.select();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    useBoard.setState({ unsaved: false });
  }, []);

  const onLoadFile = (file: File | undefined) => {
    if (!file) return;
    const state = useBoard.getState();
    if (state.unsaved && state.sequence.length && !confirm("Load this file? Unsaved changes will be lost.")) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const items = parseSequence(String(reader.result || ""));
        loadItems(items, file.name.replace(/\.(🗿|moai|txt)$/i, ""));
      } catch {
        alert("That file couldn't be loaded!");
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const state = useBoard.getState();
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const modal = state.modal;
      if (e.key === "/" && e.shiftKey && !modal) {
        e.preventDefault();
        setModal({ type: "settings" });
        return;
      }
      if (e.key === "/" && (e.ctrlKey || e.metaKey) && !modal) {
        e.preventDefault();
        setModal({ type: "shortcuts" });
        return;
      }
      if (modal) return;
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        if (livePlaying) haltPlayback({ stop: true });
        else void start(true);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const item = state.sequence.find((x) => x.uid === hoverSeqUid);
        if (item) {
          e.preventDefault();
          nudgeItem(item, e.key === "ArrowDown" ? -1 : 1, false);
        } else if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const groups = groupCount(state.sequence);
          if (groups <= 1) return;
          let n = state.selectedSection;
          const d = e.key === "ArrowDown" ? 1 : -1;
          if (n < 0) n = d < 0 ? groups - 1 : 0;
          else n = (n + d + groups) % groups;
          useBoard.getState().setSelectedSection(n);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const item = state.sequence.find((x) => x.uid === hoverSeqUid);
        if (item && item.kind === "sound") {
          e.preventDefault();
          nudgePan(item, e.key === "ArrowRight" ? 1 : -1);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveFile(e.shiftKey);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileRef.current?.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        patchSettings({ proMode: !state.settings.proMode });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        useBoard.getState().setSelectedSection(-1);
      } else if (state.settings.proMode && !e.repeat && /^[1-5]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        useBoard.getState().setHotbarTab(HOTBAR_TABS[Number(e.key) - 1]!);
      } else if (!e.ctrlKey && !e.altKey && !e.metaKey && state.settings.actionShortcuts && !e.repeat) {
        if (e.key.toLowerCase() === "x" && hoverSeqUid) {
          const item = state.sequence.find((x) => x.uid === hoverSeqUid);
          if (item?.kind === "sound") {
            useBoard.getState().setSoundTarget(item.soundId);
            placeAction("cut", true);
            return;
          }
        }
        const found = ACTIONS.find((a) => a.shortcut === e.key.toLowerCase());
        if (found) placeAction(found.id, false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [patchSettings, saveFile, setModal, start]);

  useEffect(() => {
    const onDrag = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.types?.includes("Files");
      if (e.type === "dragover" || e.type === "dragenter") {
        if (files && !livePlaying) setDraggingFile(true);
      } else if (e.type === "dragleave" || e.type === "drop") {
        setDraggingFile(false);
      }
      if (e.type === "drop") {
        if (livePlaying) return;
        const file = e.dataTransfer?.files?.[0];
        if (file) onLoadFile(file);
      }
    };
    window.addEventListener("dragover", onDrag);
    window.addEventListener("dragenter", onDrag);
    window.addEventListener("dragleave", onDrag);
    window.addEventListener("drop", onDrag);
    return () => {
      window.removeEventListener("dragover", onDrag);
      window.removeEventListener("dragenter", onDrag);
      window.removeEventListener("dragleave", onDrag);
      window.removeEventListener("drop", onDrag);
    };
  }, []);

  useEffect(() => {
    const el = document.getElementById("sequence");
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t?.closest("[data-uid]")) ev.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [sequence.length]);

  const groups = useMemo(() => {
    const g: SeqItem[][] = [[]];
    for (const it of sequence) {
      g[g.length - 1]!.push(it);
      if (it.kind === "action" && it.actionId === "divider") g.push([]);
    }
    if (g.length > 1 && g[g.length - 1]!.length === 0) g.pop();
    return g;
  }, [sequence]);

  const hasDividers = groups.length > 1;

  useEffect(() => {
    if (!pulse || settings.noAnimations) return;
    runAnimation(scroller.current, "screenpulse");
  }, [pulse, settings.noAnimations]);

  return (
    <div
      ref={scroller}
      id="everything"
      className={cn(draggingFile ? "dragOver" : "")}
      style={{ backgroundColor: bg, transition: `background-color ${bgFade}s` }}
      onPointerDown={() => unlockAudio()}
    >
      {flash > 0 ? <div key={flash} className="td-flash pointer-events-none fixed inset-0 z-40" /> : null}

      <h1
        className="title"
        id="caption"
        onClick={() => {
          cycleIntro();
          unlockAudio();
          playIntro((introIndex + 1) % 3, () => {});
        }}
      >
        {INTROS[introIndex]}
      </h1>
      <p className="remade-mark">
        <a href={ORIGINAL_SITE} target="_blank" rel="noreferrer" title="Official original site">
          REMADE
        </a>
        <a className="github" href={GITHUB_REPO} target="_blank" rel="noreferrer" title="Source on GitHub">
          GitHub
        </a>
      </p>

      <div id="main">
        <div className="sideboxes">
          <SoundsPanel mobile={mobile} />
          <div className="innersidebox actions-col">
            <ActionsPanel mobile={mobile} />
            <PlayControls
              playing={playing}
              arming={arming}
              bpm={bpm}
              volumePct={volumePct}
              transpose={transpose}
              onPlay={() => void start(false)}
              onPlaySkip={() => void start(true)}
              onStop={() => haltPlayback({ stop: true })}
              onClear={() => {
                if (!sequence.length) return;
                if (shift) useBoard.getState().clearAll();
                else setModal({ type: "clear" });
              }}
              mobile={mobile}
            />
          </div>
        </div>

        <SequencePanel groups={groups} hasDividers={hasDividers} hidden={hiddenSections} selected={selectedSection} mobile={mobile} />

        {hasDividers ? (
          <SectionBar
            selected={selectedSection}
            total={groups.length}
            hidden={hiddenSections.includes(selectedSection)}
            pinned={settings.pinSectionButtons}
          />
        ) : null}

        <SaveBar
          filename={filename}
          setFilename={setFilename}
          nameRef={nameRef}
          unsaved={unsaved}
          onSave={() => void saveFile(false)}
          onSaveAs={() => void saveFile(true)}
          onLoad={() => fileRef.current?.click()}
        />
        <input
          ref={fileRef}
          type="file"
          accept=".🗿,.moai,.txt,text/plain"
          className="hidden"
          onChange={(e) => {
            onLoadFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <div className="socialLinks" style={{ marginBottom: 10, paddingTop: 8 }}>
          <p style={{ fontSize: 20, margin: "0 10px 0 0" }}>#thirtydollarwebsite creations on:</p>
          <div className="socialTag">
            <a target="_blank" rel="noreferrer" href="https://youtube.com/results?search_query=%23thirtydollarwebsite">
              <img src={asset("assets/social_youtube.svg")} alt="" />
              <p>YouTube</p>
            </a>
          </div>
          <div className="socialTag">
            <a target="_blank" rel="noreferrer" href="https://tiktok.com/search?q=%23thirtydollarwebsite">
              <img src={asset("assets/social_tiktok.svg")} alt="" />
              <p>TikTok</p>
            </a>
          </div>
          <div className="socialTag">
            <a target="_blank" rel="noreferrer" href="https://twitter.com/search?q=%23thirtydollarwebsite&src=typed_query&f=top">
              <img src={asset("assets/social_twitter.svg")} alt="" />
              <p>Twitter</p>
            </a>
          </div>
          <div className="socialTag">
            <a target="_blank" rel="noreferrer" href={GITHUB_REPO}>
              <img src={asset("assets/social_github.svg")} alt="" />
              <p>GitHub</p>
            </a>
          </div>
        </div>
        <p style={{ marginTop: 8, textAlign: "center", color: "white" }}>
          Check out my other silly projects over at{" "}
          <a href="https://gdcolon.com?f=30" target="_blank" rel="noreferrer">
            gdcolon.com
          </a>
        </p>
        <div className="credits" style={{ marginBottom: 8 }}>
          <p>
            Remade from{" "}
            <a target="_blank" rel="noreferrer" href={ORIGINAL_SITE}>
              thirtydollar.website
            </a>{" "}
            by{" "}
            <a target="_blank" rel="noreferrer" href="https://twitter.com/TheRealGDColon">
              Colon
            </a>
          </p>
          <p title="no copyright intended">
            <a target="_blank" rel="noreferrer" href={`${GITHUB_REPO}/blob/main/LICENSE`}>
              MIT License
            </a>
            {" · "}I own pretty much nothing this was inspired by, please don't kill me
          </p>
        </div>

        <HelpButtons />

        <label className="extraSetting" style={{ margin: "12px auto 16px", width: 200, justifyContent: "center" }}>
          <input
            type="checkbox"
            className="settingBox"
            checked={proMode}
            onChange={(e) => patchSettings({ proMode: e.target.checked })}
          />
          <p style={{ fontWeight: 700, margin: "0 6px" }}>PRO MODE</p>
        </label>

        {proMode ? <div id="extraPadding" style={{ height: 220 }} /> : null}
      </div>

      {proMode ? <ProHotbar /> : null}
      <Dialogs />
    </div>
  );
}

function SoundsPanel({ mobile }: { mobile: boolean }) {
  const hover = useBoard((s) => s.hoverSound);
  const setHover = useBoard((s) => s.setHoverSound);
  const addSound = useBoard((s) => s.addSound);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SOUNDS;
    return SOUNDS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.source || "").toLowerCase().includes(q),
    );
  }, [query]);

  const onPlace = (id: string, preview: boolean) => {
    unlockAudio();
    haltPlayback();
    playSound(id);
    if (preview) return;
    addSound(id);
  };

  return (
    <div className="innersidebox" id="icons_container">
      <div className="infobox">
        {hover ? (
          <h1 id="soundInfo" style={{ color: "rgb(0, 255, 100)", whiteSpace: "nowrap" }}>
            {hover.name} <span style={{ marginLeft: 5, fontSize: 20, opacity: 0.5 }}>({hover.origin})</span>
          </h1>
        ) : (
          <h1 id="soundText">Sounds</h1>
        )}
        {mobile ? (
          <span>
            <p>Tap to add sound</p>
            <p>Hold to preview</p>
          </span>
        ) : (
          <span>
            <p>Left click to add sound</p>
            <p>Right click to preview</p>
          </span>
        )}
      </div>
      <input
        className="soundSearch"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${SOUNDS.length} sounds…`}
        aria-label="Search sounds"
      />
      <div className="iconbox" id="icons">
        {filtered.length ? (
          filtered.map((s) => (
            <SoundButton key={s.id} id={s.id} name={s.name} origin={s.source || ""} onHover={setHover} onPlace={onPlace} />
          ))
        ) : (
          <p className="emptySequence">No sounds match “{query}”</p>
        )}
      </div>
    </div>
  );
}

function SoundButton({
  id,
  name,
  origin,
  onHover,
  onPlace,
}: {
  id: string;
  name: string;
  origin: string;
  onHover: (v: { name: string; origin: string } | null) => void;
  onPlace: (id: string, preview: boolean) => void;
}) {
  const hold = useRef<number | null>(null);
  const previewed = useRef(false);
  const elRef = useRef<HTMLDivElement>(null);
  const noAnim = useBoard((s) => s.settings.noAnimations);
  const bounceSelf = () => {
    if (!noAnim) runAnimation(elRef.current, "placed");
  };
  return (
    <div
      ref={elRef}
      className="sound"
      role="button"
      tabIndex={0}
      onMouseEnter={() => onHover({ name, origin })}
      onMouseLeave={() => onHover(null)}
      onContextMenu={(e) => {
        e.preventDefault();
        bounceSelf();
        onPlace(id, true);
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "touch") {
          previewed.current = false;
          hold.current = window.setTimeout(() => {
            previewed.current = true;
            onPlace(id, true);
          }, 380);
        }
      }}
      onPointerUp={() => {
        if (hold.current) clearTimeout(hold.current);
      }}
      onPointerCancel={() => {
        if (hold.current) clearTimeout(hold.current);
      }}
      onClick={(e) => {
        if (previewed.current) {
          previewed.current = false;
          return;
        }
        if (e.button === 0) onPlace(id, false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlace(id, false);
        }
      }}
    >
      <SoundTile soundId={id} />
    </div>
  );
}

function groupCount(items: SeqItem[]) {
  let n = 1;
  for (const it of items) {
    if (it.kind === "action" && it.actionId === "divider") n += 1;
  }
  return n;
}

function nudgeItem(item: SeqItem, dir: number, ctrl: boolean) {
  const state = useBoard.getState();
  const stepMul = state.shift ? 6 : state.alt ? 0.2 : 1;
  if (item.kind === "sound" && item.soundId !== "_pause") {
    if (ctrl) {
      let vol = item.volume;
      if (!Number.isFinite(vol)) vol = 100;
      const ch = dir * (stepMul === 1 ? 2 : stepMul * 2);
      vol = clamp(vol + ch, 0, 400);
      useBoard.getState().updateItem(item.uid, { volume: Number(vol.toFixed(2)) });
      playSound(item.soundId, { ...soundOpts({ ...item, volume: vol }), stopPrevious: true });
    } else {
      const pitch = clamp(Number((item.pitch + dir * stepMul).toFixed(2)), -60, 60);
      useBoard.getState().updateItem(item.uid, { pitch });
      playSound(item.soundId, { ...soundOpts({ ...item, pitch }), stopPrevious: true });
    }
  } else if (item.kind === "action" && item.amount != null) {
    const def = ACTION_MAP.get(item.actionId);
    const bounds = def?.[item.operator ?? "set"] ?? def?.set;
    let step = bounds?.[2] ?? 1;
    if (state.shift) step *= 10;
    if (state.alt) step /= 10;
    const next = clamp(Number((item.amount + dir * step).toFixed(4)), bounds?.[0] ?? -9999, bounds?.[1] ?? 9999);
    useBoard.getState().updateItem(item.uid, { amount: next });
  }
}

function nudgePan(item: SeqSound, dir: number) {
  const state = useBoard.getState();
  const stepMul = state.shift ? 6 : state.alt ? 0.2 : 1;
  const pan = clamp(Math.round((item.pan || 0) + dir * stepMul * 5), -100, 100);
  useBoard.getState().updateItem(item.uid, { pan });
  playSound(item.soundId, { ...soundOpts({ ...item, pan }), stopPrevious: true });
}

function placeAction(id: ActionId, skipPopup: boolean) {
  const def = ACTION_MAP.get(id);
  if (!def) return;
  haltPlayback();
  const store = useBoard.getState();
  if (id === "cut") stopSounds(store.soundTargetId ?? undefined);
  if (def.twoValues) {
    if (skipPopup && def.defaultPair) {
      store.addAction(id, { val1: def.defaultPair[0], val2: def.defaultPair[1] });
    } else store.setModal({ type: id as "pulse" | "bg" });
    return;
  }
  if (def.amount) {
    if (skipPopup && def.defaultAmount != null) {
      store.addAction(id, { amount: def.defaultAmount, operator: "set" });
    } else store.setModal({ type: id as "speed" | "volume" | "stop" | "transpose" | "loopmany" });
    return;
  }
  if (id === "cut" && store.soundTargetId) {
    store.addAction(id, { soundTarget: store.soundTargetId });
    store.setSoundTarget(null);
    return;
  }
  store.addAction(id);
}

function ActionsPanel({ mobile }: { mobile: boolean }) {
  const hover = useBoard((s) => s.hoverAction);
  const shortcuts = useBoard((s) => s.settings.actionShortcuts);

  return (
    <div>
      <div className="infobox">
        {hover ? (
          <h1 id="actionInfo" style={{ color: "rgb(0, 162, 255)" }}>
            {hover.name} {shortcuts && !mobile ? <span style={{ marginLeft: 5, fontSize: 20, opacity: 0.5 }}>({hover.key})</span> : null}
          </h1>
        ) : (
          <h1 id="actionText">Actions</h1>
        )}
        <span className="mobileOnly">
          <p>Tap to add action</p>
        </span>
      </div>
      <div className="iconbox" id="actions">
        {ACTIONS.map((a) => (
          <ActionButton key={a.id} id={a.id} name={a.name} shortcut={a.shortcut} amount={!!a.amount} />
        ))}
      </div>
    </div>
  );
}

function ActionButton({
  id,
  name,
  shortcut,
  amount,
}: {
  id: ActionId;
  name: string;
  shortcut: string;
  amount: boolean;
}) {
  const setHover = useBoard((s) => s.setHoverAction);
  const noAnim = useBoard((s) => s.settings.noAnimations);
  const elRef = useRef<HTMLDivElement>(null);

  const bounceSelf = () => {
    if (!noAnim) runAnimation(elRef.current, "placed");
  };

  return (
    <div
      ref={elRef}
      className="action"
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHover({ name, key: shortcut.toUpperCase() })}
      onMouseLeave={() => setHover(null)}
      onContextMenu={(e) => {
        e.preventDefault();
        bounceSelf();
        placeAction(id, true);
      }}
      onClick={() => {
        bounceSelf();
        placeAction(id, false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          bounceSelf();
          placeAction(id, false);
        }
      }}
    >
      <ActionTile actionId={id} />
      {amount ? <p>+</p> : null}
    </div>
  );
}

function PlayControls({
  playing,
  arming,
  bpm,
  volumePct,
  transpose,
  onPlay,
  onPlaySkip,
  onStop,
  onClear,
  mobile,
}: {
  playing: boolean;
  arming: boolean;
  bpm: number;
  volumePct: number;
  transpose: number;
  onPlay: () => void;
  onPlaySkip: () => void;
  onStop: () => void;
  onClear: () => void;
  mobile: boolean;
}) {
  const hold = useRef<number | null>(null);
  const skipped = useRef(false);
  return (
    <div className="playbuttons">
      {playing || arming ? (
        <>
          <p className="playInfo stopInfo">
            {arming ? (
              "Loading sounds…"
            ) : (
              <>
                {Number(bpm.toFixed(2))} BPM &nbsp;•&nbsp; {Number(volumePct.toFixed(2))}% Volume
                {transpose ? `  •  ${transpose >= 0 ? "+" : ""}${Number(transpose.toFixed(2))} st` : ""}
              </>
            )}
          </p>
          <div
            id="stopBtn"
            role="button"
            tabIndex={0}
            style={{ backgroundColor: "var(--emojiyellow)" }}
            onClick={onStop}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onStop();
            }}
          >
            <img src={asset("assets/stop.png")} alt="" />
            <h1>Stop</h1>
          </div>
        </>
      ) : (
        <>
          <p className="playInfo">
            {mobile ? "Hold to skip intro" : "Right click to skip intro"}
          </p>
          <div
            id="playBtn"
            role="button"
            tabIndex={0}
            style={{ backgroundColor: "var(--emojigreen)" }}
            onClick={() => {
              if (skipped.current) {
                skipped.current = false;
                return;
              }
              onPlay();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onPlaySkip();
            }}
            onPointerDown={(e) => {
              if (e.pointerType !== "touch") return;
              skipped.current = false;
              hold.current = window.setTimeout(() => {
                skipped.current = true;
                onPlaySkip();
              }, 420);
            }}
            onPointerUp={() => {
              if (hold.current) clearTimeout(hold.current);
            }}
            onPointerCancel={() => {
              if (hold.current) clearTimeout(hold.current);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPlaySkip();
              }
            }}
          >
            <img src={asset("assets/play.png")} alt="" />
            <h1>Play</h1>
          </div>
        </>
      )}
      <div
        id="resetBtn"
        role="button"
        tabIndex={0}
        style={{ backgroundColor: "var(--emojired)" }}
        onClick={onClear}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClear();
        }}
      >
        <img src={asset("assets/reset.png")} alt="" />
        <h1>Clear</h1>
      </div>
    </div>
  );
}

function SequencePanel({
  groups,
  hasDividers,
  hidden,
  selected,
  mobile,
}: {
  groups: SeqItem[][];
  hasDividers: boolean;
  hidden: number[];
  selected: number;
  mobile: boolean;
}) {
  const ctrl = useBoard((s) => s.ctrl);
  const setSelected = useBoard((s) => s.setSelectedSection);
  const toggleHidden = useBoard((s) => s.toggleSectionHidden);
  const empty = groups.length === 1 && groups[0]!.length === 0;

  return (
    <div>
      <div className="infobox">
        <h1>Sequence</h1>
        {mobile ? (
          <span>
            <p>Tap to remove</p>
            <p>Swipe to change pitch</p>
          </span>
        ) : (
          <span>
            <p>Left click to remove</p>
            <p>Right click to preview</p>
            <p>Shift click to clone</p>
            <p>Scroll to change pitch</p>
            <p>Ctrl+scroll to change volume</p>
          </span>
        )}
      </div>
      <div className="iconbox" id="sequence">
        {empty ? <p className="emptySequence">Click sounds above to build a beat</p> : null}
        {groups.map((g, gi) => {
          const hid = hidden.includes(gi);
          const sel = selected === gi;
          return (
            <section
              key={gi}
              className={cn(
                ctrl && hasDividers ? "holdingCtrl" : "",
                sel ? "selectedDivider" : "",
                hid ? "sectionHidden" : "",
              )}
              onClick={(e) => {
                if (!useBoard.getState().ctrl || !hasDividers) return;
                e.stopPropagation();
                if (sel) setSelected(-1);
                else setSelected(gi);
              }}
              onContextMenu={(e) => {
                if (!useBoard.getState().ctrl || !hasDividers) return;
                e.preventDefault();
                toggleHidden(gi);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!dragUid) return;
                const seq = useBoard.getState().sequence;
                const from = seq.findIndex((x) => x.uid === dragUid);
                const last = g[g.length - 1];
                const to = last ? seq.findIndex((x) => x.uid === last.uid) : seq.length - 1;
                if (from < 0) return;
                if (dragClone) useBoard.getState().duplicate(dragUid, true);
                else useBoard.getState().moveItem(from, to);
                dragUid = null;
              }}
            >
              {g.map((it) => (
                <SeqCell key={it.uid} item={it} />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SeqCell({ item }: { item: SeqItem }) {
  const bounce = useBoard((s) => s.bounce[item.uid] || 0);
  const pulseTick = useBoard((s) => s.pulseTick[item.uid] || 0);
  const placed = useBoard((s) => s.placed[item.uid] || 0);
  const triggered = useBoard((s) => s.triggered[item.uid]);
  const countdown = useBoard((s) => s.countdown[item.uid]);
  const shift = useBoard((s) => s.shift);
  const alt = useBoard((s) => s.alt);
  const noAnim = useBoard((s) => s.settings.noAnimations);
  const lastY = useRef<number | null>(null);
  const cool = useRef(false);
  const cellRef = useRef<HTMLDivElement>(null);

  useRunAnimation(cellRef, "bounce", bounce, !noAnim);
  useRunAnimation(cellRef, "pulse", pulseTick, !noAnim);
  useRunAnimation(cellRef, "placed", placed, !noAnim);

  const onClick = (e: React.MouseEvent) => {
    if (useBoard.getState().ctrl) return;
    e.preventDefault();
    if (livePlaying) return;
    if (shift || alt) {
      useBoard.getState().duplicate(item.uid, false);
      if (item.kind === "sound") playSound(item.soundId, soundOpts(item));
    } else {
      useBoard.getState().removeAt(item.uid);
    }
  };

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    if (useBoard.getState().ctrl || livePlaying) return;
    if (shift || alt) {
      useBoard.getState().duplicate(item.uid, true);
      if (item.kind === "sound") playSound(item.soundId, soundOpts(item));
      return;
    }
    if (item.kind === "action") {
      const def = ACTION_MAP.get(item.actionId);
      if (def?.soundTarget) {
        useBoard.getState().updateItem(item.uid, { soundTarget: undefined });
        return;
      }
      if (def?.amount) {
        useBoard.getState().setEditing(item.uid);
        placeAction(item.actionId, false);
      }
      return;
    }
    playSound(item.soundId, { ...soundOpts(item), stopPrevious: true });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (livePlaying) return;
    const state = useBoard.getState();
    const xScroll = e.deltaX;
    const strongX = xScroll <= -250 || xScroll >= 250;
    if (item.kind === "sound" && state.ctrl && strongX) {
      nudgePan(item, xScroll > 0 ? 1 : -1);
      return;
    }
    const downward = e.deltaY > 0;
    nudgeItem(item, downward ? -1 : 1, state.ctrl);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (livePlaying || cool.current) return;
    const y = e.touches[0]?.clientY;
    if (y == null) return;
    const sensitivity = 50;
    if (lastY.current == null) {
      lastY.current = y;
      return;
    }
    let dir = 0;
    if (y > lastY.current + sensitivity) dir = -1;
    else if (y < lastY.current - sensitivity) dir = 1;
    else return;
    lastY.current = y;
    cool.current = true;
    setTimeout(() => {
      cool.current = false;
    }, 25);
    nudgeItem(item, dir, false);
  };

  return (
    <div
      ref={cellRef}
      data-uid={item.uid}
      draggable
      onDragStart={() => {
        dragUid = item.uid;
        dragClone = useBoard.getState().shift || useBoard.getState().alt;
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => {
        const fromUid = dragUid;
        dragUid = null;
        if (!fromUid || fromUid === item.uid) return;
        const seq = useBoard.getState().sequence;
        const from = seq.findIndex((x) => x.uid === fromUid);
        const to = seq.findIndex((x) => x.uid === item.uid);
        if (from < 0 || to < 0) return;
        if (dragClone) {
          const copyFrom = seq[from];
          if (copyFrom) useBoard.getState().duplicate(fromUid, false);
        } else {
          useBoard.getState().moveItem(from, to);
        }
      }}
      className={cn(
        "soundObj seq-cell",
        item.kind === "action" ? "action" : "sound",
        shift || alt ? "holdingShift" : "",
      )}
      onClick={onClick}
      onContextMenu={onContext}
      onWheel={onWheel}
      onTouchMove={onTouchMove}
      onTouchEnd={() => {
        lastY.current = null;
      }}
      onMouseEnter={() => {
        hoverSeqUid = item.uid;
        if (item.kind === "sound") useBoard.getState().setSoundTarget(item.soundId);
      }}
      onMouseLeave={() => {
        if (hoverSeqUid === item.uid) hoverSeqUid = null;
        useBoard.getState().setSoundTarget(null);
      }}
    >
      {item.kind === "sound" ? (
        <SoundTile soundId={item.soundId} size={58} triggered={triggered} />
      ) : (
        <ActionTile actionId={item.actionId} size={58} triggered={triggered} />
      )}
      {item.kind === "sound" && item.volume !== 100 ? <span className="vol">{item.volume}%</span> : null}
      {item.kind === "sound" && item.pan ? <span className="pan">{formatPan(item.pan)}</span> : null}
      {item.kind === "sound" && item.pitch ? <p>{formatPitch(item.pitch)}</p> : null}
      {item.kind === "action" ? (
        <p>
          {countdown ??
            (item.actionId === "bg" && typeof item.val1 === "string" ? (
              <>
                <span className="bg-swatch" style={{ background: item.val1 }} />
                {item.val2}
              </>
            ) : (
              actionLabel(item)
            ))}
        </p>
      ) : null}
      {item.kind === "action" && item.soundTarget ? (
        <span className="soundBadge" style={{ backgroundImage: `url("${getSound(item.soundTarget)?.image || asset("assets/empty.png")}")` }} />
      ) : null}
    </div>
  );
}

function soundOpts(item: SeqSound) {
  const vol = Number.isFinite(item.volume) ? item.volume : 100;
  return {
    pitch: semitonesToRate(item.pitch || 0),
    volume: vol / 200,
    pan: item.pan || 0,
  };
}

function SectionBar({
  selected,
  total,
  hidden,
  pinned,
}: {
  selected: number;
  total: number;
  hidden: boolean;
  pinned: boolean;
}) {
  const setSelected = useBoard((s) => s.setSelectedSection);
  const toggle = useBoard((s) => s.toggleSectionHidden);
  const playing = useBoard((s) => s.playing);
  const change = (d: number) => {
    if (total <= 1) return setSelected(-1);
    let n = selected;
    if (n < 0) n = d < 0 ? total - 1 : 0;
    else n = (n + d + total) % total;
    setSelected(n);
  };
  return (
    <div id="sectionSettings" className={cn(pinned ? "pinnedSettings" : "", pinned && playing ? "pinnedHidden" : "")}>
      <h1 style={{ textAlign: "left" }}>
        Selected section: <b>{selected < 0 ? "None" : selected + 1}</b>
      </h1>
      <div className="sectionControls">
        <img src={asset("assets/section_previous.png")} alt="Previous section" className="imgButton" onClick={() => change(-1)} />
        <img src={asset("assets/section_next.png")} alt="Next section" className="imgButton" onClick={() => change(1)} />
        <img
          src={asset(hidden ? "assets/section_show.png" : "assets/section_hide.png")}
          alt={hidden ? "Show section" : "Hide section"}
          className={cn("imgButton", selected < 0 ? "cantSelect" : "")}
          onClick={() => {
            if (selected >= 0) toggle(selected);
          }}
        />
        <img
          src={asset("assets/section_deselect.png")}
          alt="Deselect"
          className={cn("imgButton", selected < 0 ? "cantSelect" : "")}
          onClick={() => setSelected(-1)}
        />
      </div>
      <p className="nomobile" style={{ textAlign: "left", fontSize: 14, opacity: 0.7 }}>
        Ctrl+Click to select a section. Sounds add to the end of the selected section.
      </p>
    </div>
  );
}

function SaveBar({
  filename,
  setFilename,
  nameRef,
  unsaved,
  onSave,
  onSaveAs,
  onLoad,
}: {
  filename: string;
  setFilename: (n: string) => void;
  nameRef: RefObject<HTMLInputElement | null>;
  unsaved: boolean;
  onSave: () => void;
  onSaveAs: () => void;
  onLoad: () => void;
}) {
  const ext = useBoard((s) => (s.settings.altExtension ? ".moai" : ".🗿"));
  return (
    <div>
      <div className="playbuttons saveButtons" id="saveOptions" style={{ marginTop: 7, flexDirection: "row", justifyContent: "center" }}>
        <div
          id="saveBtn"
          role="button"
          tabIndex={0}
          className={cn(!unsaved ? "alreadySaved" : "")}
          onClick={onSave}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSave();
          }}
        >
          <img src={asset("assets/save.svg")} alt="" />
          <h1>Save</h1>
        </div>
        <div
          id="downloadBtn"
          role="button"
          tabIndex={0}
          onClick={onSaveAs}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSaveAs();
          }}
        >
          <img src={asset("assets/download.svg")} alt="" />
          <h1>Save As</h1>
        </div>
        <div
          id="loadBtn"
          role="button"
          tabIndex={0}
          onClick={onLoad}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onLoad();
          }}
        >
          <img src={asset("assets/load.svg")} alt="" />
          <h1>Load</h1>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", margin: "7px 0 16px" }}>
        <input
          ref={nameRef}
          id="saveName"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="sequence"
          style={{ height: 32, width: 200, backgroundColor: "rgba(0,0,0,0.25)" }}
        />
        <p style={{ margin: "0 0 0 6px", fontSize: 20 }}>{ext}</p>
      </div>
    </div>
  );
}

function ProHotbar() {
  const tab = useBoard((s) => s.hotbarTab);
  const setTab = useBoard((s) => s.setHotbarTab);
  const recent = useBoard((s) => s.recent);
  const addSound = useBoard((s) => s.addSound);
  const playing = useBoard((s) => s.playing);
  const [hint, setHint] = useState<{ name: string; extra: string; color: string } | null>(null);

  const pool = useMemo(() => {
    if (tab === "actions") return { sounds: [] as typeof SOUNDS, actions: ACTIONS };
    if (tab === "notes") return { sounds: SOUNDS.filter((s) => s.tags?.includes("note")), actions: [] as typeof ACTIONS };
    if (tab === "percussion") return { sounds: SOUNDS.filter((s) => s.tags?.includes("percussion")), actions: [] as typeof ACTIONS };
    if (tab === "recent") {
      const sounds = recent
        .filter((id) => !id.startsWith("."))
        .map((id) => getSound(id))
        .filter(Boolean) as typeof SOUNDS;
      const actions = recent
        .filter((id) => id.startsWith("."))
        .map((id) => ACTION_MAP.get(id.slice(1) as ActionId))
        .filter(Boolean) as typeof ACTIONS;
      return { sounds: sounds.reverse(), actions: actions.reverse() };
    }
    return { sounds: SOUNDS, actions: [] as typeof ACTIONS };
  }, [tab, recent]);

  const tabs: { id: (typeof HOTBAR_TABS)[number]; label: string; icon: string }[] = [
    { id: "sounds", label: "Sounds", icon: asset("assets/tab_all.svg") },
    { id: "actions", label: "Actions", icon: asset("assets/tab_actions.svg") },
    { id: "recent", label: "Recent", icon: asset("assets/tab_recent.svg") },
    { id: "notes", label: "Notes", icon: asset("assets/tab_notes.svg") },
    { id: "percussion", label: "Percussion", icon: asset("assets/tab_percussion.svg") },
  ];

  return (
    <div id="proHotbar" className={playing ? "playing" : ""}>
      <p className="hotbarLabel" id="hotbarHovertext" style={{ color: hint?.color || "transparent", minHeight: 22 }}>
        {hint ? (
          <>
            {hint.name} <span style={{ opacity: 0.7 }}>{hint.extra}</span>
          </>
        ) : (
          "\u00a0"
        )}
      </p>
      <div className="hotbarTabs">
        {tabs.map((t, i) => (
          <div
            key={t.id}
            className={cn("hotbarTab", tab === t.id ? "selectedTab" : "")}
            onClick={() => setTab(t.id)}
            onMouseEnter={() => setHint({ name: t.label, extra: `(${i + 1})`, color: "var(--yellowfont)" })}
            onMouseLeave={() => setHint(null)}
            title={t.label}
            role="button"
            tabIndex={0}
          >
            <img src={t.icon} alt={t.label} />
          </div>
        ))}
      </div>
      <div className="hotbar" id="hotbarNotes">
        {pool.sounds.map((s) => (
          <div
            key={s.id}
            className="sound"
            role="button"
            tabIndex={0}
            onClick={() => {
              if (livePlaying) return;
              playSound(s.id);
              addSound(s.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              playSound(s.id);
            }}
            onMouseEnter={() => setHint({ name: s.name, extra: s.source ? `(${s.source})` : "", color: "var(--greenfont)" })}
            onMouseLeave={() => setHint(null)}
            title={s.name}
          >
            <SoundTile soundId={s.id} size={48} />
          </div>
        ))}
        {pool.actions.map((a) => (
          <div
            key={a.id}
            className="action"
            role="button"
            tabIndex={0}
            onClick={() => placeAction(a.id, false)}
            onContextMenu={(e) => {
              e.preventDefault();
              placeAction(a.id, true);
            }}
            onMouseEnter={() => setHint({ name: a.name, extra: `(${a.shortcut.toUpperCase()})`, color: "var(--bluefont)" })}
            onMouseLeave={() => setHint(null)}
            title={a.name}
          >
            <ActionTile actionId={a.id} size={48} />
            {a.amount ? <p>+</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

