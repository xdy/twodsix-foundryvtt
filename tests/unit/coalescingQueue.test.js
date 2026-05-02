import { describe, it, expect, vi } from 'vitest';
import { createCoalescingTaskQueue, createSerializedAsyncQueue } from '../../src/module/features/coalescingQueue.js';

describe('createCoalescingTaskQueue', () => {
  it('should execute only the latest task when multiple are enqueued', async () => {
    const queue = createCoalescingTaskQueue();
    const results = [];

    const id1 = queue.bumpRequestId();
    queue.enqueue(id1, async () => { results.push(1); });
    const id2 = queue.bumpRequestId();
    await queue.enqueue(id2, async () => { results.push(2); });

    expect(results).toEqual([2]);
  });

  it('should execute task if it is still the latest when processed', async () => {
    const queue = createCoalescingTaskQueue();
    const results = [];

    const id1 = queue.bumpRequestId();
    await queue.enqueue(id1, async () => { results.push(1); });

    expect(results).toEqual([1]);
  });

  it('should skip stale tasks', async () => {
    const queue = createCoalescingTaskQueue();
    const results = [];

    const id1 = queue.bumpRequestId();
    const id2 = queue.bumpRequestId();
    const id3 = queue.bumpRequestId();

    queue.enqueue(id1, async () => { results.push(1); });
    queue.enqueue(id3, async () => { results.push(3); });
    await queue.enqueue(id2, async () => { results.push(2); });

    expect(results).toEqual([3]);
  });

  it('should call onError when provided', async () => {
    const onError = vi.fn();
    const queue = createCoalescingTaskQueue(onError);

    const id = queue.bumpRequestId();
    await queue.enqueue(id, async () => { throw new Error('test error'); });

    expect(onError).toHaveBeenCalledWith(expect.any(Error), id);
  });

  it('should log to console.error when no onError provided', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const queue = createCoalescingTaskQueue();

    const id = queue.bumpRequestId();
    await queue.enqueue(id, async () => { throw new Error('test error'); });

    expect(consoleSpy).toHaveBeenCalledWith('Twodsix | coalescingQueue: task failed:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});

describe('createSerializedAsyncQueue', () => {
  it('should execute tasks sequentially', async () => {
    const queue = createSerializedAsyncQueue();
    const results = [];

    const p1 = queue.runSerialized(async () => { results.push(1); return 'a'; });
    const p2 = queue.runSerialized(async () => { results.push(2); return 'b'; });
    const p3 = queue.runSerialized(async () => { results.push(3); return 'c'; });

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(results).toEqual([1, 2, 3]);
    expect(r1).toBe('a');
    expect(r2).toBe('b');
    expect(r3).toBe('c');
  });

  it('should continue after errors', async () => {
    const queue = createSerializedAsyncQueue();
    const results = [];

    queue.runSerialized(async () => { throw new Error('fail'); });
    await queue.runSerialized(async () => { results.push('after error'); });

    expect(results).toEqual(['after error']);
  });

  it('should call onError when provided', async () => {
    const onError = vi.fn();
    const queue = createSerializedAsyncQueue(onError);

    const promise = queue.runSerialized(async () => { throw new Error('test error'); });
    await expect(promise).rejects.toThrow('test error');
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
