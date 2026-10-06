// The training videos' pointer, which a recording doesn't show.

/**
 * Drawn on every page: an arrow that follows the mouse (kept across pages), and on a
 * phone a fingertip where it's touched, shown coming down by a "film-finger" event.
 */
export function pointer(phone: boolean) {
  const show = () => {
    const root = document.documentElement;
    const fixed = {
      position: "fixed",
      left: "0",
      top: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
    };
    const pulse = (x: number, y: number, size: number) => {
      const ring = document.createElement("div");
      Object.assign(ring.style, fixed, {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: "rgba(255, 159, 28, 0.45)",
        transform: `translate(${x - size / 2}px, ${y - size / 2}px)`,
      });
      root.append(ring);
      ring
        .animate(
          [
            { opacity: 1, scale: "0.4" },
            { opacity: 0, scale: "1.6" },
          ],
          { duration: 450, easing: "ease-out" },
        )
        .finished.then(
          () => ring.remove(),
          () => ring.remove(),
        );
    };
    if (phone) {
      const finger = document.createElement("div");
      Object.assign(finger.style, fixed, {
        width: "46px",
        height: "46px",
        borderRadius: "50%",
        background: "rgba(255, 255, 255, 0.55)",
        border: "2px solid rgba(0, 0, 0, 0.45)",
        boxShadow: "0 3px 10px rgba(0, 0, 0, 0.35)",
        opacity: "0",
        transition: "opacity 200ms, scale 350ms ease-out",
      });
      root.append(finger);
      const at = (x: number, y: number) =>
        (finger.style.transform = `translate(${x - 23}px, ${y - 23}px)`);
      document.addEventListener("film-finger", (event) => {
        const { x, y } = (event as CustomEvent<{ x: number; y: number }>)
          .detail;
        finger.style.transition = "none";
        at(x, y);
        finger.style.scale = "1.5";
        finger.getBoundingClientRect();
        finger.style.transition = "opacity 200ms, scale 350ms ease-out";
        finger.style.opacity = "1";
        finger.style.scale = "1";
      });
      addEventListener(
        "touchstart",
        (event) => {
          const touch = event.touches[0];
          if (!touch) return;
          at(touch.clientX, touch.clientY);
          finger.style.opacity = "1";
          finger.style.scale = "0.85";
          pulse(touch.clientX, touch.clientY, 70);
        },
        { capture: true, passive: true },
      );
      addEventListener(
        "touchend",
        () =>
          setTimeout(() => {
            finger.style.scale = "1";
            finger.style.opacity = "0";
          }, 250),
        { capture: true, passive: true },
      );
      return;
    }
    const arrow = document.createElement("div");
    arrow.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24"><path d="M5 2.5 19 13l-6.3.9 3.7 7.3-2.7 1.4-3.7-7.4L5 20Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
    Object.assign(arrow.style, fixed, {
      display: "none",
      filter: "drop-shadow(0 2px 3px rgba(0, 0, 0, 0.45))",
    });
    root.append(arrow);
    const at = (x: number, y: number) => {
      // The arrow's tip is at (5, 2.5) of 24.
      arrow.style.transform = `translate(${x - 6}px, ${y - 3}px)`;
      arrow.style.display = "block";
      sessionStorage.setItem("film-mouse", JSON.stringify([x, y]));
    };
    const last = sessionStorage.getItem("film-mouse");
    if (last) at(...(JSON.parse(last) as [number, number]));
    // While a row is dragged, the browser sends drag events instead of mouse moves.
    for (const type of ["mousemove", "dragover"])
      addEventListener(
        type,
        (e) => at((e as MouseEvent).clientX, (e as MouseEvent).clientY),
        {
          capture: true,
          passive: true,
        },
      );
    addEventListener("mousedown", (e) => pulse(e.clientX, e.clientY, 44), {
      capture: true,
      passive: true,
    });
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", show);
  else show();
}
