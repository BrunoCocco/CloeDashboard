import type { CaptureMetadata, CaptureRecord } from "./model";
const NAME = "cloe-reviewed-captures-v1";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no está disponible en este navegador."));
      return;
    }
    let settled = false;
    const request = indexedDB.open(NAME, 1);
    const timer = setTimeout(() => {
      settled = true;
      reject(
        new Error(
          "No se pudo abrir el archivo local. Cerrá otras pestañas e intentá otra vez.",
        ),
      );
    }, 10000);
    request.onupgradeneeded = () => {
      const db = request.result;
      const records = db.createObjectStore("records", {
        keyPath: ["ownerId", "id"],
      });
      records.createIndex("owner-date", ["ownerId", "createdAt"]);
      records.createIndex("owner-asset-date", [
        "ownerId",
        "asset",
        "createdAt",
      ]);
      db.createObjectStore("images", { keyPath: ["ownerId", "id"] });
    };
    request.onerror = () => {
      clearTimeout(timer);
      settled = true;
      reject(
        new Error(
          "No se pudo abrir el archivo local; verificá los permisos del navegador.",
        ),
      );
    };
    request.onblocked = () => {
      clearTimeout(timer);
      settled = true;
      reject(
        new Error(
          "Otra pestaña bloquea el archivo local; cerrala e intentá de nuevo.",
        ),
      );
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (settled) request.result.close();
      else resolve(request.result);
    };
  });
}
function storageError() {
  return new Error(
    "No se guardó el corte. El navegador puede no tener espacio o permiso. Exportá la imagen y las notas antes de cerrar.",
  );
}
export async function saveCapture(record: CaptureRecord): Promise<void> {
  if (
    !record.ownerId ||
    !record.reviewed ||
    !record.id ||
    !(record.image instanceof Blob)
  )
    throw new Error("Corte sin propietario, imagen o revisión.");
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["records", "images"], "readwrite");
    const { image, ...metadata } = record;
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(storageError());
    };
    // add, never put: a second cut cannot silently replace an earlier snapshot.
    tx.objectStore("records").add(metadata);
    tx.objectStore("images").add({
      ownerId: record.ownerId,
      id: record.id,
      image,
    });
  });
}
export async function listCaptures(
  ownerId: string,
  asset?: string,
): Promise<CaptureMetadata[]> {
  if (!ownerId) throw new Error("Propietario requerido.");
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readonly");
    const prefix = asset ? [ownerId, asset] : [ownerId];
    const query = IDBKeyRange.bound([...prefix, ""], [...prefix, "\uffff"]);
    const cursor = tx
      .objectStore("records")
      .index(asset ? "owner-asset-date" : "owner-date")
      .openCursor(query, "prev");
    const rows: CaptureMetadata[] = [];
    cursor.onsuccess = () => {
      const current = cursor.result;
      if (current && rows.length < 100) {
        rows.push(current.value);
        current.continue();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(rows);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(new Error("No se pudo leer el histórico local."));
    };
  });
}
export async function readCapture(
  ownerId: string,
  id: string,
): Promise<CaptureRecord | null> {
  if (!ownerId || !id)
    throw new Error("Propietario e identificador requeridos.");
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["records", "images"], "readonly");
    const metadata = tx.objectStore("records").get([ownerId, id]);
    const image = tx.objectStore("images").get([ownerId, id]);
    tx.oncomplete = () => {
      db.close();
      resolve(
        metadata.result && image.result
          ? { ...metadata.result, image: image.result.image }
          : null,
      );
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(new Error("No se pudo abrir el corte local."));
    };
  });
}
