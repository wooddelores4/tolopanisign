
const cache = new Map<string, string>();

export const getFromCache = (key: string): string | undefined => {
  return cache.get(key);
};

export const setInCache = (key: string, value: string) => {
  cache.set(key, value);
};
