/**
 * offlineQueue.ts
 * Cola de operaciones pendientes para modo offline.
 * Guarda en localStorage y sincroniza cuando vuelve el internet.
 */
import * as api from './api';

const QUEUE_KEY = 'barrapro_offline_queue';

export type OfflineOp =
  | { type: 'recarga'; payload: any }
  | { type: 'cortesia'; payload: any }
  | { type: 'perdida'; payload: any }
  | { type: 'descuento'; payload: any }
  | { type: 'gasto'; payload: any };

export function enqueue(op: OfflineOp): void {
  const queue = getQueue();
  queue.push({ ...op, enqueuedAt: new Date().toISOString() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getQueue(): (OfflineOp & { enqueuedAt: string })[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch { return []; }
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export async function flush(): Promise<{ ok: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { ok: 0, failed: 0 };

  let ok = 0;
  let failed = 0;
  const remaining: typeof queue = [];

  for (const op of queue) {
    try {
      let success = false;
      if (op.type === 'recarga')   success = await api.createRecarga(op.payload);
      if (op.type === 'cortesia')  success = await api.createCortesia(op.payload);
      if (op.type === 'perdida')   success = await api.createPerdida(op.payload);
      if (op.type === 'descuento') success = await api.createDescuento(op.payload);
      if (op.type === 'gasto')     success = await api.createGasto(op.payload);

      if (success) { ok++; } else { failed++; remaining.push(op); }
    } catch {
      failed++;
      remaining.push(op);
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { ok, failed };
}
