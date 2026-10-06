import { generate } from "lean-qr";
import { toSvgDataURL } from "lean-qr/extras/svg";

/** A QR code of a link on this site, for a phone's camera. */
export function QrImage({
  path,
  label,
  big = false,
}: {
  path: string;
  label: string;
  /** The page's main way in. */
  big?: boolean;
}) {
  return (
    <img
      src={toSvgDataURL(generate(`${location.origin}${path}`), {
        on: "black",
        off: "white",
        pad: 2,
      })}
      alt={label}
      className={`${big ? "size-72" : "size-48"} rounded-xl`}
    />
  );
}
