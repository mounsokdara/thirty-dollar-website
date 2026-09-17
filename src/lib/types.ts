export type SoundTag = "note" | "percussion" | "melody";

export type Operator = "set" | "add" | "multiply" | "divide";

export type SoundDef = {
  id: string;
  name: string;
  source?: string;
  tags?: SoundTag[];
  emoji?: string;
  img?: string;
  useID?: boolean;
  image: string;
};

export type ActionId =
  | "speed"
  | "volume"
  | "stop"
  | "transpose"
  | "loopmany"
  | "loop"
  | "looptarget"
  | "combine"
  | "jump"
  | "target"
  | "cut"
  | "startpos"
  | "divider"
  | "flash"
  | "pulse"
  | "bg";

export type ActionDef = {
  id: ActionId;
  name: string;
  shortcut: string;
  amount?: boolean;
  isTarget?: boolean;
  soundTarget?: boolean;
  twoValues?: boolean;
  colorMode?: boolean;
  defaultAmount?: number;
  defaultPair?: [number | string, number];
  set?: [number, number, number?, string?];
  add?: [number, number, number?, string?];
  multiply?: [number, number, number?, string?];
  divide?: [number, number, number?, string?];
  unit?: string;
};

export type SeqSound = {
  uid: string;
  kind: "sound";
  soundId: string;
  pitch: number;
  volume: number;
  pan: number;
};

export type SeqAction = {
  uid: string;
  kind: "action";
  actionId: ActionId;
  amount?: number;
  operator?: Operator;
  val1?: string | number;
  val2?: number;
  soundTarget?: string;
};

export type SeqItem = SeqSound | SeqAction;

export type Settings = {
  actionShortcuts: boolean;
  autoScroll: boolean;
  pinSectionButtons: boolean;
  exitConfirmation: boolean;
  noAnimations: boolean;
  invertPanning: boolean;
  altExtension: boolean;
  proMode: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  actionShortcuts: true,
  autoScroll: false,
  pinSectionButtons: false,
  exitConfirmation: false,
  noAnimations: false,
  invertPanning: false,
  altExtension: false,
  proMode: false,
};

export const DEFAULT_TEMPO = 300;
export const DEFAULT_VOLUME = 100;
export const DEFAULT_BG = "#36393c";
