import type {
  ReplicationBenchmarkManifest,
  ReplicationBenchmarkObservation,
  ReplicationBenchmarkPhase
} from '../types/ReplicationBenchmark.js';

/** Counters for the timed phase. Evidence also includes the untimed initial snapshot. */
export function replicationWorkCounters(
  phase: ReplicationBenchmarkPhase,
  manifest: ReplicationBenchmarkManifest,
  operations: ReplicationBenchmarkObservation['operations']
): { source_rows: number; writer_save_calls: number; bucket_operations: number } {
  const rows =
    phase === 'snapshot'
      ? manifest.snapshotRows
      : manifest.transactions.flatMap((transaction) => transaction.mutations.map((mutation) => mutation.row));

  const bucket_operations =
    phase === 'snapshot'
      ? operations.length
      : operations.filter((operation) => operation.object_id != null && measuredIds.has(operation.object_id)).length;

  const measuredIds = new Set(rows.map((row) => row.id));

  return {
    source_rows: rows.length,
    // The benchmark's insert-only workload expects one writer save per source row.
    writer_save_calls: rows.length,
    bucket_operations
  };
}
