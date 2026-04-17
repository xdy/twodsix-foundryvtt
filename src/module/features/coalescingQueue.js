/**
 * Serial async queue where each task carries a monotonic request id; stale tasks no-op.
 * Used by Trader and CharGen journal flag saves so rapid updates coalesce to the latest write.
 */
export function createCoalescingTaskQueue(onError) {
  let chain = Promise.resolve();
  let latestId = 0;

  return {
    bumpRequestId() {
      return ++latestId;
    },

    /**
     * @param {number} requestId - Value from {@link bumpRequestId} when the save was requested
     * @param {() => Promise<void>} fn
     * @returns {Promise<void>} The tail promise of the queue (await to wait for this task's turn)
     */
    enqueue(requestId, fn) {
      chain = chain
        .then(async () => {
          if (requestId < latestId) {
            return;
          }
          await fn();
        })
        .catch(err => {
          if (typeof onError === 'function') {
            onError(err, requestId);
          } else {
            console.error('Twodsix | coalescingQueue: task failed:', err);
          }
        });
      return chain;
    },
  };
}

/**
 * FIFO mutex for async work (e.g. journal page read-modify-write appends).
 * Each task runs after the previous completes; failures are reported via `onError` and the chain continues.
 */
export function createSerializedAsyncQueue(onError) {
  let chain = Promise.resolve();

  return {
    /**
     * @template T
     * @param {() => Promise<T>} fn
     * @returns {Promise<T>}
     */
    runSerialized(fn) {
      const op = chain.then(() => fn());
      chain = op.catch(err => {
        if (typeof onError === 'function') {
          onError(err);
        } else {
          console.error('Twodsix | serializedAsyncQueue: task failed:', err);
        }
      });
      return op;
    },
  };
}
