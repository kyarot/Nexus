type StoredBody =
  | { type: "none" }
  | { type: "text"; data: string }
  | { type: "formdata"; data: Array<{ key: string; value: string | Blob }> }
  | { type: "blob"; data: Blob };

interface OutboxEntry {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: StoredBody;
  createdAt: number;
  retryCount: number;
  requiresAuth: boolean;
}

export interface QueuedResult {
  queued: true;
  outboxId: string;
}

const DB_NAME = "nexus-offline";
const STORE_NAME = "outbox";
let isProcessing = false;
let syncStarted = false;

const getAuthToken = () => localStorage.getItem("nexus_access_token");

const normalizeHeaders = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {};
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers } as Record<string, string>;
};

const serializeBody = (body?: BodyInit | null): StoredBody => {
  if (!body) return { type: "none" };
  if (typeof body === "string") return { type: "text", data: body };
  if (body instanceof FormData) {
    const data: Array<{ key: string; value: string | Blob }> = [];
    body.forEach((value, key) => {
      data.push({ key, value });
    });
    return { type: "formdata", data };
  }
  if (body instanceof URLSearchParams) {
    return { type: "text", data: body.toString() };
  }
  if (body instanceof Blob) {
    return { type: "blob", data: body };
  }
  return { type: "text", data: String(body) };
};

const restoreBody = (stored: StoredBody): BodyInit | undefined => {
  if (stored.type === "none") return undefined;
  if (stored.type === "text") return stored.data;
  if (stored.type === "blob") return stored.data;
  if (stored.type === "formdata") {
    const form = new FormData();
    stored.data.forEach(({ key, value }) => {
      form.append(key, value);
    });
    return form;
  }
  return undefined;
};

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

const addEntry = async (entry: OutboxEntry) => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const deleteEntry = async (id: string) => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const getAllEntries = async (): Promise<OutboxEntry[]> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result || []) as OutboxEntry[]);
    request.onerror = () => reject(request.error);
  });
};

const updateEntry = async (entry: OutboxEntry) => {
  await addEntry(entry);
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `outbox_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export const isQueuedResult = (value: unknown): value is QueuedResult =>
  Boolean(value && typeof value === "object" && (value as QueuedResult).queued === true);

export const getOutboxCount = async () => {
  const entries = await getAllEntries();
  return entries.length;
};

export const enqueueOutboxRequest = async (entry: Omit<OutboxEntry, "id" | "createdAt" | "retryCount">) => {
  const id = createId();
  await addEntry({
    ...entry,
    id,
    createdAt: Date.now(),
    retryCount: 0,
  });
  return id;
};

export const processOutbox = async () => {
  if (isProcessing || !navigator.onLine) return;
  isProcessing = true;
  try {
    const entries = await getAllEntries();
    const sorted = entries.sort((a, b) => a.createdAt - b.createdAt);
    for (const entry of sorted) {
      const headers = new Headers(entry.headers);
      if (entry.requiresAuth) {
        const token = getAuthToken();
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
      }
      const body = restoreBody(entry.body);
      try {
        const response = await fetch(entry.url, {
          method: entry.method,
          headers,
          body,
        });
        if (response.ok) {
          await deleteEntry(entry.id);
        } else {
          await updateEntry({ ...entry, retryCount: entry.retryCount + 1 });
        }
      } catch {
        await updateEntry({ ...entry, retryCount: entry.retryCount + 1 });
      }
    }
  } finally {
    isProcessing = false;
  }
};

export const startOutboxSync = () => {
  if (syncStarted) return;
  syncStarted = true;
  window.addEventListener("online", () => {
    void processOutbox();
  });
  if (navigator.onLine) {
    void processOutbox();
  }
};

interface FetchWithOutboxOptions {
  queueIfOffline?: boolean;
}

export const fetchWithOutbox = async (
  url: string,
  init: RequestInit = {},
  options: FetchWithOutboxOptions = {}
): Promise<{ response?: Response; queued?: QueuedResult }> => {
  const method = (init.method || "GET").toUpperCase();
  const shouldQueue = options.queueIfOffline ?? method !== "GET";

  if (!shouldQueue || method === "GET") {
    return { response: await fetch(url, init) };
  }

  const headers = normalizeHeaders(init.headers);
  const requiresAuth = Boolean(headers.Authorization || headers.authorization);
  delete headers.Authorization;
  delete headers.authorization;

  const body = serializeBody(init.body);
  const queueEntry = async () =>
    enqueueOutboxRequest({
      url,
      method,
      headers: body.type === "formdata" ? Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== "content-type")) : headers,
      body,
      requiresAuth,
    });

  if (!navigator.onLine) {
    const outboxId = await queueEntry();
    return { queued: { queued: true, outboxId } };
  }

  try {
    const response = await fetch(url, init);
    return { response };
  } catch (error) {
    if (error instanceof TypeError) {
      const outboxId = await queueEntry();
      return { queued: { queued: true, outboxId } };
    }
    throw error;
  }
};
