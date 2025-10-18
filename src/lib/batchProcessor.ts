/**
 * Phase 4: Batch Processor
 * Processes multiple elements efficiently using requestAnimationFrame
 */

import { Logger } from '@/types';

export interface BatchTask<T> {
  item: T;
  process: () => void;
}

export interface BatchResult {
  total: number;
  processed: number;
  failed: number;
  duration: number;
}

/**
 * Process items in batches using rAF to avoid blocking the main thread
 */
export class BatchProcessor<T> {
  private tasks: BatchTask<T>[] = [];
  private batchSize: number;
  private onProgress?: (processed: number, total: number) => void;
  private onComplete?: (result: BatchResult) => void;
  private startTime = 0;
  private processed = 0;
  private failed = 0;

  constructor(batchSize = 10) {
    this.batchSize = batchSize;
  }

  /**
   * Add items to be processed
   */
  addTasks(tasks: BatchTask<T>[]): void {
    this.tasks.push(...tasks);
  }

  /**
   * Set progress callback
   */
  onProgressUpdate(callback: (processed: number, total: number) => void): void {
    this.onProgress = callback;
  }

  /**
   * Set completion callback
   */
  onBatchComplete(callback: (result: BatchResult) => void): void {
    this.onComplete = callback;
  }

  /**
   * Start processing the batch
   */
  async start(): Promise<BatchResult> {
    this.startTime = performance.now();
    this.processed = 0;
    this.failed = 0;

    Logger.info(`Starting batch processing: ${this.tasks.length} items`);

    return new Promise((resolve) => {
      this.processBatch(resolve);
    });
  }

  /**
   * Process one batch of items
   */
  private processBatch(resolve: (result: BatchResult) => void): void {
    const batch = this.tasks.splice(0, this.batchSize);

    if (batch.length === 0) {
      // All done
      const duration = performance.now() - this.startTime;
      const result: BatchResult = {
        total: this.processed + this.failed,
        processed: this.processed,
        failed: this.failed,
        duration,
      };

      Logger.info('Batch processing complete:', result);

      if (this.onComplete) {
        this.onComplete(result);
      }

      resolve(result);
      return;
    }

    // Process batch with error handling
    for (const task of batch) {
      try {
        task.process();
        this.processed++;
      } catch (error) {
        this.failed++;
        console.error('Batch processing error:', error);
        
        // Phase 8: Circuit breaker - stop if too many failures
        if (this.failed > this.tasks.length * 0.5) {
          console.error('Too many failures - stopping batch processing');
          break;
        }
      }
    }

    // Report progress
    if (this.onProgress) {
      this.onProgress(this.processed + this.failed, this.processed + this.failed + this.tasks.length);
    }

    // Schedule next batch
    requestAnimationFrame(() => this.processBatch(resolve));
  }

  /**
   * Clear all pending tasks
   */
  clear(): void {
    this.tasks = [];
    this.processed = 0;
    this.failed = 0;
  }
}

/**
 * Helper to process array with rAF scheduling
 */
export async function processInBatches<T>(
  items: T[],
  processor: (item: T) => void,
  batchSize: number = 10,
  onProgress?: (current: number, total: number) => void
): Promise<BatchResult> {
  // Phase 8: Optimize batch size for large sets
  const optimizedBatchSize = items.length > 1000 ? Math.min(batchSize, 20) : batchSize;

  const tasks: BatchTask<T>[] = items.map(item => ({
    item,
    process: () => processor(item),
  }));

  const batch = new BatchProcessor<T>(optimizedBatchSize);

  batch.addTasks(tasks);

  if (onProgress) {
    batch.onProgressUpdate(onProgress);
  }

  return batch.start();
}
