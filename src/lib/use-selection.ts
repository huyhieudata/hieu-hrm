import { useCallback, useState } from "react";

export const useSelection = () => {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.includes(id));
      return allSelected ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]));
    });
  }, []);

  const clear = useCallback(() => setSelected([]), []);

  const prune = useCallback((validIds: string[]) => {
    setSelected((prev) => prev.filter((id) => validIds.includes(id)));
  }, []);

  return { selected, setSelected, toggle, selectAll, clear, prune };
};
