import { expect, it } from 'vitest';
import { ResourceAdmission, PROCESSING_BUDGET_BYTES } from '../admission';
it('admits compression ahead of queued background thumbnails', async () => {
  const gate = new ResourceAdmission();
  const release = await gate.acquire('active', PROCESSING_BUDGET_BYTES);
  const order: string[] = [];
  const thumbnail = gate.acquire('thumbnail', PROCESSING_BUDGET_BYTES, 0).then((done) => {
    order.push('thumbnail');
    done!();
  });
  const processing = gate.acquire('processing', PROCESSING_BUDGET_BYTES, 10).then((done) => {
    order.push('processing');
    done!();
  });
  release!();
  await Promise.all([thumbnail, processing]);
  expect(order).toEqual(['processing', 'thumbnail']);
});
it('holds overlapping large submissions until the reservation is released', async () => {
  const gate = new ResourceAdmission();
  const release = await gate.acquire('first', PROCESSING_BUDGET_BYTES);
  let started = false;
  const second = gate.acquire('second', 1).then((value) => {
    started = true;
    return value;
  });
  await Promise.resolve();
  expect(started).toBe(false);
  release!();
  (await second)!();
  expect(started).toBe(true);
});
it('cancels waiting work without reading its file', async () => {
  const gate = new ResourceAdmission();
  const release = await gate.acquire('first', PROCESSING_BUDGET_BYTES);
  const pending = gate.acquire('cancelled', 1);
  gate.cancel('cancelled');
  expect(await pending).toBeNull();
  release!();
});
it('rejects oversized work and releases reservations once', async () => {
  const gate = new ResourceAdmission();
  await expect(gate.acquire('huge', PROCESSING_BUDGET_BYTES + 1)).rejects.toThrow(/memory/);
  const release = await gate.acquire('first', PROCESSING_BUDGET_BYTES);
  release!();
  release!();
  (await gate.acquire('next', PROCESSING_BUDGET_BYTES))!();
});
