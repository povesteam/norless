import { lazy } from "react";

// Pages load when first opened, so a first visit downloads and parses less; the service
// worker keeps them all after that.
export const RecordingPage = lazy(() =>
  import("../stage/Recordings").then((m) => ({ default: m.RecordingPage })),
);
export const RecordingsPage = lazy(() =>
  import("../stage/Recordings").then((m) => ({ default: m.RecordingsPage })),
);
export const StatisticsPage = lazy(() =>
  import("../songs/Statistics").then((m) => ({ default: m.StatisticsPage })),
);
export const ChangesPage = lazy(() =>
  import("../settings/ChangesPage").then((m) => ({ default: m.ChangesPage })),
);
export const FeaturesPage = lazy(() =>
  import("./FeatureTree").then((m) => ({ default: m.FeaturesPage })),
);
export const MySchedulePage = lazy(() =>
  import("../team/MySchedule").then((m) => ({ default: m.MySchedulePage })),
);
export const NotificationsPage = lazy(() =>
  import("../team/Notifications").then((m) => ({
    default: m.NotificationsPage,
  })),
);
export const TeamSchedulePage = lazy(() =>
  import("../team/TeamSchedule").then((m) => ({ default: m.TeamSchedulePage })),
);
export const HostPage = lazy(() =>
  import("../live/Host").then((m) => ({ default: m.HostPage })),
);
export const AboutPage = lazy(() =>
  import("./AboutPage").then((m) => ({ default: m.AboutPage })),
);
export const AccountPage = lazy(() =>
  import("../account/AccountPage").then((m) => ({ default: m.AccountPage })),
);
export const LoginLinkPage = lazy(() =>
  import("../account/LoginLinkPage").then((m) => ({
    default: m.LoginLinkPage,
  })),
);
export const DevGooglePage = lazy(() =>
  import("../account/LoginPage").then((m) => ({ default: m.DevGooglePage })),
);
export const LoginPage = lazy(() =>
  import("../account/LoginPage").then((m) => ({ default: m.LoginPage })),
);
export const AppIdeasPage = lazy(() =>
  import("./Feedback").then((m) => ({ default: m.AppIdeasPage })),
);
export const IdeasPage = lazy(() =>
  import("./Feedback").then((m) => ({ default: m.IdeasPage })),
);
export const UsagePage = lazy(() =>
  import("../settings/UsagePage").then((m) => ({ default: m.UsagePage })),
);
export const SettingsPage = lazy(() =>
  import("../settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
export const PlaylistPage = lazy(() =>
  import("../playlists/PlaylistPage").then((m) => ({
    default: m.PlaylistPage,
  })),
);
export const PrivacyPage = lazy(() =>
  import("./PrivacyPage").then((m) => ({ default: m.PrivacyPage })),
);
export const PairCodePage = lazy(() =>
  import("../account/Pairing").then((m) => ({ default: m.PairCodePage })),
);
export const ApproveDevicePage = lazy(() =>
  import("../account/ApproveDevice").then((m) => ({
    default: m.ApproveDevicePage,
  })),
);
export const EnterCodePage = lazy(() =>
  import("../account/ApproveDevice").then((m) => ({
    default: m.EnterCodePage,
  })),
);
export const GuestPage = lazy(() =>
  import("../account/GuestPass").then((m) => ({ default: m.GuestPage })),
);
export const PlaylistsPage = lazy(() =>
  import("../playlists/PlaylistsPage").then((m) => ({
    default: m.PlaylistsPage,
  })),
);
export const ChordsPage = lazy(() =>
  import("../chords/ChordsMode").then((m) => ({ default: m.ChordsPage })),
);
export const SongEditor = lazy(() =>
  import("../songs/SongEditor").then((m) => ({ default: m.SongEditor })),
);
export const SongEditPage = lazy(() =>
  import("../songs/SongEditor").then((m) => ({ default: m.SongEditPage })),
);
export const SongPage = lazy(() =>
  import("../songs/SongPage").then((m) => ({ default: m.SongPage })),
);
