// A paired screen loads in what it showed last on this device, as
// index.html reads it before the first paint: an overlay stays transparent for OBS.
const KEY = "norless:screen-background";

export const lastBackground = () => {
  try {
    return localStorage.getItem(KEY) ?? "#000";
  } catch {
    return "#000";
  }
};

export const rememberBackground = (background: string) => {
  try {
    localStorage.setItem(KEY, background);
  } catch {
    // This device then loads it black.
  }
};
