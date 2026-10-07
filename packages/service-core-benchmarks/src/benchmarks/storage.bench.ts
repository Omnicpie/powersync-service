import { randomUUID } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { NodeProcessResourceMonitor } from '../monitors/NodeProcessResourceMonitor.js';
import { createDatabaseResourceMonitors } from '../monitors/database-monitors.js';
import { StorageBenchmark } from '../runner/StorageBenchmark.js';
import { storageBenchmarkCases } from '../scenarios/benchmark-cases.js';
import { writeBenchmarkResult } from '../utils/output.js';

describe.each(storageBenchmarkCases)('$scenario.id', ({ scenario, implementation, expectedStorage }) => {
  test('runs', { timeout: scenario.timeout_ms, sequential: true, tags: scenario.tags }, async () => {
    const benchmark = new StorageBenchmark(scenario, implementation, {
      runId: randomUUID(),
      monitors: [new NodeProcessResourceMonitor(), ...createDatabaseResourceMonitors(scenario)],
      signal: AbortSignal.timeout(scenario.timeout_ms - 10_000)
    });

    const result = await benchmark.run();

    await writeBenchmarkResult(result);
    // Log the result
    console.info(
      JSON.stringify(
        {
          scenario: result.scenario.id,
          summary: result.summary,
          resources: result.iterations
            .filter((iteration) => iteration.kind === 'measured')
            .map((iteration) => iteration.resources)
        },
        null,
        2
      )
    );

    // Check everything worked
    // TODO: maybe remove? is this useful?
    expect(result.status, JSON.stringify(result, null, 2)).toBe('passed');
    expect(result.scenario.storage).toEqual(expectedStorage);
    expect(result.iterations.map(({ kind, status }) => ({ kind, status }))).toEqual([
      { kind: 'warmup', status: 'passed' },
      { kind: 'measured', status: 'passed' },
      { kind: 'measured', status: 'passed' },
      { kind: 'measured', status: 'passed' }
    ]);
    expect(result.iterations[0].resources).toEqual([]);
    expect(
      result.iterations.every((iteration) =>
        iteration.correctness?.checks.some((check) => check.name === 'sample_payload_bytes' && check.passed)
      )
    ).toBe(true);
    expect(
      result.iterations
        .slice(1)
        .map((iteration) => iteration.resources.map(({ component, status }) => ({ component, status })))
    ).toEqual([
      [
        { component: 'load_generator', status: 'available' },
        { component: 'storage_database', status: expect.stringMatching(/available|unavailable/) }
      ],
      [
        { component: 'load_generator', status: 'available' },
        { component: 'storage_database', status: expect.stringMatching(/available|unavailable/) }
      ],
      [
        { component: 'load_generator', status: 'available' },
        { component: 'storage_database', status: expect.stringMatching(/available|unavailable/) }
      ]
    ]);
    expect(result.summary).toMatchObject({
      measured_iterations: 3,
      successful_iterations: 3,
      failed_iterations: 0,
      boundaries: {
        [scenario.primary_boundary]: { sample_count: 3 }
      },
      counters: {
        source_rows: { sample_count: 3, min: 10_000, max: 10_000 },
        payload_bytes: { sample_count: 3, min: 2_560_000, max: 2_560_000 },
        bucket_operations: { sample_count: 3, min: 10_000, max: 10_000 },
        parameter_operations: { sample_count: 3, min: 0, max: 0 },
        distinct_buckets: {
          sample_count: 3,
          min: scenario.expected_bucket_count,
          max: scenario.expected_bucket_count
        }
      }
    });
    if (scenario.mode !== 'write') {
      expect(result.summary?.boundaries.storage_read?.sample_count).toBe(3);
      expect(result.summary?.counters.read_data_bytes?.min).toBeGreaterThan(0);
    }
    if (scenario.mode !== 'read') {
      expect(result.summary?.boundaries.storage_write?.sample_count).toBe(3);
      expect(result.summary?.counters.writer_save_calls?.min).toBe(10_000);
    }
  });
});
