import { useState, useEffect } from "react";
const cache = /* @__PURE__ */ new Map();
function useCachedResource(key, fetcher) {
  const [data, setData] = useState(() => key != null ? cache.get(key) : void 0);
  const [loading, setLoading] = useState(() => !(key != null && cache.has(key)));
  useEffect(() => {
    let alive = true;
    if (key == null) return;
    if (!cache.has(key)) setLoading(true);
    Promise.resolve(fetcher()).then((d) => {
      if (!alive) return;
      cache.set(key, d);
      setData(d);
      setLoading(false);
    }).catch(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  const mutate = (updater) => {
    setData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (key != null) cache.set(key, next);
      return next;
    });
  };
  return { data, loading, mutate, setData: mutate };
}
function getCached(key) {
  return key != null ? cache.get(key) : void 0;
}
function setCached(key, val) {
  if (key != null) cache.set(key, val);
}
export {
  getCached as g,
  setCached as s,
  useCachedResource as u
};
