import { container } from '@powersync/lib-services-framework';
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, test } from 'vitest';
import { env } from '../env.js';
import { MongoStorageBenchmarkImplementation } from '../implementations/storage/MongoStorageBenchmarkImplementation.js';
import { PostgresStorageBenchmarkImplementation } from '../implementations/storage/PostgresStorageBenchmarkImplementation.js';
import { NodeProcessResourceMonitor } from '../monitors/NodeProcessResourceMonitor.js';
import { createDatabaseResourceMonitors } from '../monitors/database-monitors.js';
import { ApiBenchmark } from '../runner/ApiBenchmark.js';
import {
  createMongoCategoryApiScenario,
  createMongoQuickApiScenario,
  createPostgresCategoryApiScenario,
  createPostgresQuickApiScenario
} from '../scenarios/api-scenarios.js';
import {
  MONGO_STORAGE_BENCHMARK_VERSIONS,
  POSTGRES_STORAGE_BENCHMARK_VERSIONS
} from '../scenarios/storage-versions.js';
import { ApiBenchmarkScenario } from '../types/ApiBenchmark.js';
import { StorageBenchmarkImplementation } from '../types/StorageBenchmark.js';
import { writeBenchmarkResult } from '../utils/output.js';

beforeAll(() => {
  container.registerDefaults();
});

interface ApiBenchmarkCase {
  readonly scenario: ApiBenchmarkScenario;
  readonly implementation: StorageBenchmarkImplementation;
}

const cases: readonly ApiBenchmarkCase[] = [
  ...POSTGRES_STORAGE_BENCHMARK_VERSIONS.flatMap((version) => [
    createPostgresCase(createPostgresCategoryApiScenario(version)),
    createPostgresCase(createPostgresQuickApiScenario(version))
  ]),
  ...MONGO_STORAGE_BENCHMARK_VERSIONS.flatMap((version) => [
    createMongoCase(createMongoQuickApiScenario(version)),
    createMongoCase(createMongoCategoryApiScenario(version))
  ])
];

function createPostgresCase(scenario: ApiBenchmarkScenario): ApiBenchmarkCase {
  return {
    scenario,
    implementation: new PostgresStorageBenchmarkImplementation({
      url: env.PG_STORAGE_TEST_URL
    })
  };
}

function createMongoCase(scenario: ApiBenchmarkScenario): ApiBenchmarkCase {
  return {
    scenario,
    implementation: new MongoStorageBenchmarkImplementation({
      url: env.MONGO_TEST_URL,
      isCI: env.CI
    })
  };
}

describe.each(cases)('$scenario.id', ({ scenario, implementation }) => {
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
