import {
  BetweenHorizontalStart,
  CirclePlay,
  AlignLeft,
  AudioLines,
  Drum,
  Grid2x2,
  Hash,
  LayoutList,
  ListMusic,
  Piano,
  BookOpen,
  Columns2,
  Columns3,
  FileText,
  Grid3x3,
  Guitar,
  Laptop,
  LayoutDashboard,
  ListOrdered,
  type LucideIcon,
  MicVocal,
  MonitorSpeaker,
  Music,
  Presentation,
  Projector,
  RadioTower,
  RectangleHorizontal,
  Smartphone,
  Square,
  Tablet,
  Type,
  Activity,
  BellDot,
  Cast,
  ChartColumn,
  Copyright,
  DoorOpen,
  Download,
  FileClock,
  FileMusic,
  FilePlus,
  Clock,
  Keyboard,
  Lightbulb,
  Link2,
  ListVideo,
  LogIn,
  Megaphone,
  Menu,
  MonitorPlay,
  Palette,
  Printer,
  QrCode,
  Rainbow,
  ThumbsUp,
  TriangleAlert,
  Users,
  Zap,
  Mic,
  Radio,
  TextCursor,
  FileImage,
  Webhook,
  WifiOff,
  ClipboardList,
  Bell,
  CalendarSync,
  MonitorUp,
  Sunrise,
} from "lucide-react";
import type { EntryKind } from "../../server/playlists/playlists";
import type { DeviceType } from "../../shared/preferences";
import type { Feature, Planned } from "../../shared/features";
import type { ScreenType } from "../../shared/screens";

/** The host view's icon, in the bar and an entry's menu. */
export { Megaphone as HostIcon };
/** The welcome page's, in the Pages menu and its settings. */
export { Sunrise as WelcomeIcon };

/** Each entry type's icon; dividers are headings without one. */
const entryIcons = {
  song: Music,
  bible: BookOpen,
  text: FileText,
  slides: FileImage,
};

export function EntryIcon({
  kind,
  className,
}: {
  kind: EntryKind;
  className?: string;
}) {
  if (kind === "divider") return null;
  const Icon = entryIcons[kind];
  return <Icon className={className} />;
}

const screenIcons = {
  projector: Projector,
  musicians: Guitar,
  vocalists: MicVocal,
  stage: MonitorSpeaker,
  overlay: RadioTower,
};

/** Each screen type's icon. */
export function ScreenIcon({
  type,
  className,
}: {
  type: ScreenType;
  className?: string;
}) {
  const Icon = screenIcons[type];
  return <Icon className={className} />;
}

const layoutIcons: Record<string, LucideIcon> = {
  controller: LayoutDashboard,
  "running-order": ListOrdered,
  big: Presentation,
  "big-screen": MonitorUp,
  tablet: Tablet,
  phone: Smartphone,
  classic: Columns3,
  "side-by-side": Columns2,
  one: Square,
  "bar-grid": Grid3x3,
  chords: Type,
  whole: AlignLeft,
  sideways: RectangleHorizontal,
  "guitar-words": Guitar,
  "guitar-bars": Grid2x2,
  "guitar-chart": ListMusic,
  "keys-concert": Piano,
  "keys-numbers": Hash,
  "drums-parts": LayoutList,
  "drums-cue": Drum,
  "bass-roots": AudioLines,
  "live-chord": Radio,
};

/** A layout's icon, by its id in any view's list of layouts. */
export function LayoutIcon({ id }: { id: string }) {
  const Icon = layoutIcons[id];
  return Icon ? <Icon /> : null;
}

const deviceIcons = { phone: Smartphone, tablet: Tablet, laptop: Laptop };

/** A device type's icon. */
export function DeviceIcon({
  type,
  ...props
}: { type: DeviceType } & React.SVGProps<SVGSVGElement>) {
  const Icon = deviceIcons[type];
  return <Icon {...props} />;
}

/** Country codes where a language's code misleads: Ukrainian is uk, but UK reads as Britain. */
const countryCodes: Record<string, string> = { uk: "UA" };

/** A language's short label: RO, UA, EN. */
export const languageCode = (language: string) =>
  countryCodes[language] ?? language.toUpperCase();

/** The community languages' flags, drawn here so every device shows the same (Windows has no flag emoji). */
const flags: Record<string, React.ReactNode> = {
  ro: (
    <>
      <rect width="1" height="2" fill="#002b7f" />
      <rect x="1" width="1" height="2" fill="#fcd116" />
      <rect x="2" width="1" height="2" fill="#ce1126" />
    </>
  ),
  uk: (
    <>
      <rect width="3" height="1" fill="#0057b7" />
      <rect y="1" width="3" height="1" fill="#ffd700" />
    </>
  ),
  // English: the United Kingdom's, simplified for its size.
  en: (
    <>
      <rect width="3" height="2" fill="#012169" />
      <path d="M0 0L3 2M3 0L0 2" stroke="#fff" strokeWidth="0.4" />
      <path d="M0 0L3 2M3 0L0 2" stroke="#c8102e" strokeWidth="0.15" />
      <path d="M1.5 0V2M0 1H3" stroke="#fff" strokeWidth="0.6" />
      <path d="M1.5 0V2M0 1H3" stroke="#c8102e" strokeWidth="0.36" />
    </>
  ),
};

/** A language's flag, where it has one. */
export function LanguageFlag({ language }: { language: string }) {
  const flag = flags[language];
  if (!flag) return null;
  return (
    <svg
      viewBox="0 0 3 2"
      aria-hidden
      className="h-[0.8em] w-[1.2em] shrink-0 rounded-[2px]"
    >
      {flag}
    </svg>
  );
}

/** A language's flag and short label. */
export function LanguageMark({ language }: { language: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <LanguageFlag language={language} />
      {languageCode(language)}
    </span>
  );
}

/** Each feature's icon in the feature tree: the one its button or link has in the app. */
export const featureIcons: Record<Feature, LucideIcon> = {
  feedback: Lightbulb,
  deviceLogin: LogIn,
  export: Printer,
  appFrame: Menu,
  layouts: LayoutDashboard,
  textSlides: FilePlus,
  times: Clock,
  problems: TriangleAlert,
  commands: Zap,
  presence: Users,
  mediaKeys: Keyboard,
  stageViews: MonitorSpeaker,
  screenMenu: MonitorPlay,
  touchLayouts: Tablet,
  chords: FileMusic,
  instruments: Guitar,
  recordings: AudioLines,
  tempoCheck: Activity,
  screens: Projector,
  projectHere: Cast,
  followAlong: QrCode,
  shortLinks: Link2,
  sideBySide: Columns2,
  install: Download,
  theme: Palette,
  songFeedback: ThumbsUp,
  credits: Copyright,
  statistics: ChartColumn,
  chapters: ListVideo,
  chordColors: Rainbow,
  host: Megaphone,
  changes: FileClock,
  practiceRooms: DoorOpen,
  midiChords: Piano,
  audioChords: Mic,
  liveChord: Radio,
  serviceRoles: ClipboardList,
  pushNotifications: Bell,
  churchCalendar: CalendarSync,
  offline: WifiOff,
  playlistNews: BellDot,
  replays: CirclePlay,
  fileSlides: FileImage,
  bigScreen: MonitorUp,
  welcome: Sunrise,
  insertBetween: BetweenHorizontalStart,
};

/** Each planned feature's icon, for its node in the feature tree. */
export const plannedIcons: Record<Planned, LucideIcon> = {
  chordHelper: TextCursor,
  webhooks: Webhook,
};
