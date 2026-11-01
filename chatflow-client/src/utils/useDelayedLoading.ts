import { useEffect, useState } from "react";

export function useDelayedLoading(loading: boolean, delay = 180) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loading) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [loading, delay]);

  return visible;
}