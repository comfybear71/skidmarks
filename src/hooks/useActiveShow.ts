import { useEffect, useState } from "react";

const ACTIVE_SHOW_KEY = "crash-active-show";

export function useActiveShow() {
  const [activeShow, setActiveShow] = useState<string>("Skidmarks");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Load from localStorage on mount
    try {
      const saved = localStorage.getItem(ACTIVE_SHOW_KEY);
      if (saved) {
        setActiveShow(saved);
      }
    } catch {
      /* ignore */
    }
    setIsReady(true);
  }, []);

  const switchShow = (show: string) => {
    setActiveShow(show);
    try {
      localStorage.setItem(ACTIVE_SHOW_KEY, show);
    } catch {
      /* ignore */
    }
  };

  return {
    activeShow,
    switchShow,
    isReady,
  };
}
