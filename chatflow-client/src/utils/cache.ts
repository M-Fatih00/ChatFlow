const store = new Map<string, unknown>();

export const cache = {
  get<T>(key: string): T | undefined {
    return store.get(key) as T | undefined;
  },
  set<T>(key: string, value: T) {
    store.set(key, value);
  },
  clear() {
    store.clear();
  },
};