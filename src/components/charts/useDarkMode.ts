"use client";

import { useEffect, useState } from "react";

/** Follows the OS color scheme (prefers-color-scheme). Starts light so server and first client render match. */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return dark;
}
