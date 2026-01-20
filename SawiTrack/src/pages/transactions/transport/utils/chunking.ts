/**
 * Chunking Utility
 * Handles batch processing of large datasets with progress tracking
 */

import type { ImportProgress } from "../types";

/**
 * Split array into chunks of specified size
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Process array in chunks with progress callback
 * Returns results from all chunks combined
 */
export async function processInChunks<T, R>(
  items: T[],
  chunkSize: number,
  processor: (chunk: T[], chunkIndex: number) => Promise<R[]>,
  onProgress?: (progress: ImportProgress) => void
): Promise<R[]> {
  const chunks = chunkArray(items, chunkSize);
  const results: R[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Update progress
    if (onProgress) {
      onProgress({
        current: i * chunkSize + chunk.length,
        total: items.length,
        percentage: Math.round(((i + 1) / chunks.length) * 100),
        stage: "uploading",
      });
    }

    // Process chunk
    try {
      const chunkResults = await processor(chunk, i);
      results.push(...chunkResults);
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}/${chunks.length}:`, error);
      throw new Error(
        `Gagal memproses batch ${i + 1}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    // Small delay between chunks to prevent overwhelming the server
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Batch create items with retry logic
 */
export async function batchCreate<T, R>(
  items: T[],
  createFn: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    maxRetries?: number;
    retryDelay?: number;
    onProgress?: (progress: ImportProgress) => void;
  } = {}
): Promise<R[]> {
  const {
    batchSize = 50,
    maxRetries = 3,
    retryDelay = 1000,
    onProgress,
  } = options;

  const results: R[] = [];
  const chunks = chunkArray(items, batchSize);

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    let retries = 0;
    let success = false;

    while (!success && retries < maxRetries) {
      try {
        // Process all items in chunk concurrently
        const chunkResults = await Promise.all(
          chunk.map((item) => createFn(item))
        );

        results.push(...chunkResults);
        success = true;

        // Update progress
        if (onProgress) {
          onProgress({
            current: (chunkIndex + 1) * batchSize,
            total: items.length,
            percentage: Math.round(((chunkIndex + 1) / chunks.length) * 100),
            stage: "uploading",
          });
        }
      } catch (error) {
        retries++;

        if (retries >= maxRetries) {
          throw new Error(
            `Gagal memproses batch ${chunkIndex + 1}/${
              chunks.length
            } setelah ${maxRetries} percobaan: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }

        // Wait before retrying
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * retries)
        );
      }
    }

    // Small delay between successful chunks
    if (chunkIndex < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Calculate progress information
 */
export function calculateProgress(
  current: number,
  total: number,
  stage: ImportProgress["stage"] = "uploading"
): ImportProgress {
  return {
    current: Math.min(current, total),
    total,
    percentage: total > 0 ? Math.round((current / total) * 100) : 0,
    stage,
  };
}

/**
 * Format progress message
 */
export function formatProgressMessage(progress: ImportProgress): string {
  const stageLabels: Record<ImportProgress["stage"], string> = {
    validating: "Memvalidasi data",
    "creating-companies": "Membuat PT baru",
    "creating-estates": "Membuat estate baru",
    uploading: "Mengunggah data",
  };

  return `${stageLabels[progress.stage]}: ${progress.current}/${
    progress.total
  } (${progress.percentage}%)`;
}
