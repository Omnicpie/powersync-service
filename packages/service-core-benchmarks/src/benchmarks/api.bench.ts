import { container } from '@powersync/lib-services-framework';
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, test } from 'vitest';
import { NodeProcessResourceMonitor } from '../monitors/NodeProcessResourceMonitor.js';
import { createDatabaseResourceMonitors } from '../monitors/database-monitors.js';
import { ApiBenchmark } from '../runner/ApiBenchmark.js';
import { apiBenchmarkCases } from '../scenarios/benchmark-cases.js';
import { writeBenchmarkResult } from '../utils/output.js';

beforeAll(() => {
  container.registerDefaults();
});

describe.each(apiBenchmarkCases)('$scenario.id', ({ scenario, implementation }) => {
  test('runs', { timeout: scenario.timeout_ms, sequential: true, tags: scenario.tags }, async () => {
    const benchmark = new ApiBenchmark(scenario, implementation, {
      runId: randomUUID(),
      monitors: [new NodeProcessResourceMonitor(), ...createDatabaseResourceMonitors(scenario)],
      signal: AbortSignal.timeout(scenario.timeout_ms - 10_000)
    });

    const result = await benchmark.run();
    await writeBenchmarkResult(result);

    console.info(JSON.stringify({ scenario: result.scenario.id, summary: result.summary }, null, 2));

    expect(result.status, JSON.stringify(result, null, 2)).toBe('passed');
    expect(result.scenario.storage).toEqual(scenario.storage);
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
      boundaries: { http_read: { sample_count: 3 } }
    });
  });
});
