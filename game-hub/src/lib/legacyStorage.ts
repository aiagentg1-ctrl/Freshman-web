const LEGACY_PREFIX = "mirkuz";
const CURRENT_PREFIX = "fresho";

function migrateStorage(storage: Storage): void {
  const legacyKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(LEGACY_PREFIX)) legacyKeys.push(key);
  }

  for (const legacyKey of legacyKeys) {
    const currentKey = `${CURRENT_PREFIX}${legacyKey.slice(LEGACY_PREFIX.length)}`;
    if (storage.getItem(currentKey) === null) {
      const value = storage.getItem(legacyKey);
      if (value !== null) storage.setItem(currentKey, value);
    }
    storage.removeItem(legacyKey);
  }
}

export function migrateLegacyStorage(): void {
  if (typeof window === "undefined") return;
  migrateStorage(window.localStorage);
  migrateStorage(window.sessionStorage);
}
