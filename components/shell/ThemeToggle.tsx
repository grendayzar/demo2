"use client";
import { Icon } from "./Icon";

/** No React state: the current theme lives on <html data-theme>, and CSS picks which icon shows. */
export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  function toggle() {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("pr-theme", next); } catch {}
  }
  return (
    <button type="button" onClick={toggle} className={withLabel ? "navitem" : "btn btn-ghost btn-sm"} title="Toggle night mode" aria-label="Toggle night mode">
      <span className="dark-only"><Icon name="sun" size={17} /></span>
      <span className="light-only"><Icon name="moon" size={17} /></span>
      {withLabel && <><span className="dark-only">Light mode</span><span className="light-only">Night mode</span></>}
    </button>
  );
}
