import { randomUUID } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { NodeProcessResourceMonitor } from '../monitors/NodeProcessResourceMonitor.js';
import { createDatabaseResourceMonitors } from '../monitors/database-monitors.js';
import { CombinedBenchmark } from '../runner/CombinedBenchmark.js';
import { combinedBenchmarkCases } from '../scenarios/benchmark-cases.js';
import { writeBenchmarkResult } from '../utils/output.js';

describe.each(combinedBenchmarkCases)('$scenario.id', ({ scenario, implementation }) => {
  test('runs', { timeout: scenario.timeout_ms, sequential: true, tags: scenario.tags }, async () => {
    const benchmark = new CombinedBenchmark(scenario, implementation, {
      runId: randomUUID(),
      monitors: [
        new NodeProcessResourceMonitor(),
        implementation.createServiceMonitor(),
        ...createDatabaseResourceMonitors(scenario)
      ],
      signal: AbortSignal.timeout(scenario.timeout_ms - 10_000)
    });

    const result = await benchmark.run();
    await writeBenchmarkResult(result);

    expect(result.status, JSON.stringify(result, null, 2)).toBe('passed');
    expect(result.iterations.map(({ kind, status }) => ({ kind, status }))).toEqual([
      { kind: 'warmup', status: 'passed' },
      { kind: 'measured', status: 'passed' },
      { kind: 'measured', status: 'passed' },
      { kind: 'measured', status: 'passed' }
    ]);
    expect(result.summary).toMatchObject({
      measured_iterations: 3,
      successful_iterations: 3,
      failed_iterations: 0,
      boundaries: {
        replication_snapshot: { sample_count: 3 },
        http_read: { sample_count: 3 },
        end_to_end_snapshot: { sample_count: 3 }
      }
    });
  });
});
