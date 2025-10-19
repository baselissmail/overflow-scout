/**
 * Phase 8: Performance Monitor
 * Tracks and optimizes performance for large-scale testing
 */

import { Logger } from '@/types';

export class PerformanceMonitor {
  private static measurements = new Map<string, number[]>();
  private static readonly MAX_ELEMENTS_PER_BATCH = 50; // Optimized for performance
  private static readonly LONG_TASK_THRESHOLD = 50; // ms

  /**
   * Start a performance measurement
   */
  static start(label: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.record(label, duration);

      if (duration > this.LONG_TASK_THRESHOLD) {
        Logger.warn(`Long task detected: ${label} took ${duration.toFixed(2)}ms`);
      }
    };
  }

  /**
   * Record a measurement
   */
  private static record(label: string, duration: number): void {
    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
    this.measurements.get(label)!.push(duration);
  }

  /**
   * Get statistics for a measurement
   */
  static getStats(label: string): { avg: number; min: number; max: number; count: number } | null {
    const measurements = this.measurements.get(label);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    return { avg, min, max, count: measurements.length };
  }

  /**
   * Log all performance stats
   */
  static logStats(): void {
    Logger.info('Performance Statistics:');
    for (const [label] of this.measurements) {
      const stats = this.getStats(label);
      if (stats) {
        Logger.info(`  ${label}:`, {
          avg: `${stats.avg.toFixed(2)}ms`,
          min: `${stats.min.toFixed(2)}ms`,
          max: `${stats.max.toFixed(2)}ms`,
          count: stats.count,
        });
      }
    }
  }

  /**
   * Calculate optimal batch size based on performance
   */
  static getOptimalBatchSize(elementCount: number): number {
    // For very large sets, use smaller batches to avoid jank
    if (elementCount > 1000) {
      return 20;
    } else if (elementCount > 500) {
      return 30;
    } else if (elementCount > 100) {
      return 50;
    } else {
      return Math.min(elementCount, this.MAX_ELEMENTS_PER_BATCH);
    }
  }

  /**
   * Check if we should throttle operations
   */
  static shouldThrottle(elementCount: number): boolean {
    return elementCount > 1000;
  }

  /**
   * Clear all measurements
   */
  static clear(): void {
    this.measurements.clear();
  }
}
