import { useLayoutEffect, useRef, useState } from "react";

/**
 * Draws its content at `width` × `height` and scales it into the tile's width. A scaled
 * box contains even what's fixed to the screen inside it; `inert` keeps clicks out, so
 * a preview never changes what's live.
 */
export function Scaled({
  width,
  height,
  children,
  className = "",
}: {
  width: number;
  height: number;
  children: React.ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale((entry?.contentRect.width ?? 0) / width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);
  return (
    <div
      ref={box}
      className={`relative w-full overflow-hidden rounded-lg ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div
        inert
        className="absolute start-0 top-0 origin-top-left"
        style={{ width, height, transform: `scale(${scale})` }}
      >
        {scale > 0 && children}
      </div>
    </div>
  );
}
