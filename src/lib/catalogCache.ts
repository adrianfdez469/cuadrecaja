import type { IPosCategoria, IProductoTiendaPos } from "@/schemas/producto";

/**
 * The POS catalog, cached on the device.
 *
 * Opening the POS used to sit on a spinner until the whole catalog came down
 * the wire — every time, on connections that are frequently the worst part of
 * the setup. With this the cashier gets the last known catalog immediately and
 * a refresh lands behind it, so selling never waits on the network.
 *
 * IndexedDB and not `localStorage`: the payload runs to megabytes, and
 * `localStorage` is synchronous — writing it would block the main thread for
 * exactly as long as the parse it replaces.
 */

const DB_NAME = "cuadrecaja-pos";
const STORE_NAME = "catalog";
const DB_VERSION = 1;

/**
 * Bumped whenever the cached shape — or what it is understood to contain —
 * changes. An entry written by an older version of the app is ignored rather
 * than migrated: the network copy is authoritative and one extra load is a
 * fair price for never rendering a product whose fields moved.
 *
 * v2 → v3: the entry now holds the whole catalog, sold-out products included.
 * A v2 entry has them stripped out, and offline there is no way to tell that
 * from a shop that simply does not stock them — which is exactly the case
 * selling without stock exists for.
 */
const CACHE_SCHEMA_VERSION = 3;

interface CachedCatalog {
  schemaVersion: number;
  cachedAt: number;
  productos: IProductoTiendaPos[];
  categorias: IPosCategoria[];
}

export interface CatalogSnapshot {
  productos: IProductoTiendaPos[];
  categorias: IPosCategoria[];
  cachedAt: number;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    // Private browsing, a full disk, a blocked origin: the POS works without
    // the cache, it just loads the way it used to.
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

/** The catalog last stored for this store, or null if there is none usable. */
export async function readCatalog(
  tiendaId: string,
): Promise<CatalogSnapshot | null> {
  if (!tiendaId) return null;
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    // Closed inside the handlers, never in a `finally`: `close()` is
    // synchronous and would abort the transaction before it ever ran.
    const finish = (value: CatalogSnapshot | null) => {
      db.close();
      resolve(value);
    };
    try {
      const request = db
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(tiendaId);
      request.onsuccess = () => {
        const cached = request.result as CachedCatalog | undefined;
        if (!cached || cached.schemaVersion !== CACHE_SCHEMA_VERSION) {
          finish(null);
          return;
        }
        finish({
          productos: cached.productos,
          categorias: cached.categorias,
          cachedAt: cached.cachedAt,
        });
      };
      request.onerror = () => finish(null);
    } catch {
      finish(null);
    }
  });
}

/** Stores the catalog for this store. Failures are silent by design. */
export async function writeCatalog(
  tiendaId: string,
  productos: IProductoTiendaPos[],
  categorias: IPosCategoria[],
): Promise<void> {
  if (!tiendaId) return;
  const db = await openDatabase();
  if (!db) return;
  return new Promise((resolve) => {
    const finish = () => {
      db.close();
      resolve();
    };
    try {
      const entry: CachedCatalog = {
        schemaVersion: CACHE_SCHEMA_VERSION,
        cachedAt: Date.now(),
        productos,
        categorias,
      };
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(entry, tiendaId);
      tx.oncomplete = finish;
      tx.onerror = finish;
      tx.onabort = finish;
    } catch {
      finish();
    }
  });
}
