import { randomUUID } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { MongoStorageBenchmarkImplementation } from '../implementations/storage/MongoStorageBenchmarkImplementation.js';
import { PostgresStorageBenchmarkImplementation } from '../implementations/storage/PostgresStorageBenchmarkImplementation.js';
import { NodeProcessResourceMonitor } from '../monitors/NodeProcessResourceMonitor.js';
import { UnavailableResourceMonitor } from '../monitors/UnavailableResourceMonitor.js';
import { StorageBenchmark } from '../runner/StorageBenchmark.js';
import {
  createMongoCategoryStorageScenario,
  createMongoQuickStorageScenario,
  createPostgresCategoryStorageScenario,
  createPostgresQuickStorageScenario
} from '../scenarios/storage-scenarios.js';
import {
  MONGO_STORAGE_BENCHMARK_VERSIONS,
  POSTGRES_STORAGE_BENCHMARK_VERSIONS
} from '../scenarios/storage-versions.js';
import { StorageBenchmarkImplementation, StorageBenchmarkScenario } from '../types/StorageBenchmark.js';
import { writeBenchmarkResult } from '../utils/output.js';

interface StorageBenchmarkCase {
  readonly scenario: StorageBenchmarkScenario;
  readonly implementation: StorageBenchmarkImplementation;
  readonly expectedStorage: StorageBenchmarkScenario['storage'];
  readonly unavailableMonitorReason: string;
}

const benchmarkCases: readonly StorageBenchmarkCase[] = [
  ...POSTGRES_STORAGE_BENCHMARK_VERSIONS.flatMap((version) => [
    createPostgresCase(createPostgresCategoryStorageScenario(version)),
    createPostgresCase(createPostgresQuickStorageScenario(version))
  ]),
  ...MONGO_STORAGE_BENCHMARK_VERSIONS.flatMap((version) => [
    createMongoCase(createMongoQuickStorageScenario(version)),
    createMongoCase(createMongoCategoryStorageScenario(version))
  ])
];

function createPostgresCase(scenario: StorageBenchmarkScenario): StorageBenchmarkCase {
  return {
    scenario,
    implementation: new PostgresStorageBenchmarkImplementation({
      url: process.env.PG_STORAGE_TEST_URL ?? 'postgres://postgres:postgres@localhost:5432/powersync_storage_test'
    }),
    expectedStorage: { implementation: 'storage:postgres', version: scenario.storage.version },
    unavailableMonitorReason: 'PostgreSQL database resource monitoring is not implemented'
  };
}

function createMongoCase(scenario: StorageBenchmarkScenario): StorageBenchmarkCase {
  return {
    scenario,
    implementation: new MongoStorageBenchmarkImplementation({
      url: process.env.MONGO_TEST_URL ?? 'mongodb://localhost:27017/powersync_test',
      isCI: process.env.CI === 'true'
    }),
    expectedStorage: { implementation: 'storage:mongodb', version: scenario.storage.version },
    unavailableMonitorReason: 'MongoDB database resource monitoring is not implemented'
  };
}

describe.each(benchmarkCases)(
  '$scenario.id',
  ({ scenario, implementation, unavailableMonitorReason, expectedStorage }) => {
    test('runs', { timeout: scenario.timeout_ms, sequential: true, tags: scenario.tags }, async () => {
      const benchmark = new StorageBenchmark(scenario, implementation, {
        runId: randomUUID(),
        monitors: [
          new NodeProcessResourceMonitor(),
          new UnavailableResourceMonitor('storage_database', unavailableMonitorReason)
        ],
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
          { component: 'storage_database', status: 'unavailable' }
        ],
        [
          { component: 'load_generator', status: 'available' },
          { component: 'storage_database', status: 'unavailable' }
        ],
        [
          { component: 'load_generator', status: 'available' },
          { component: 'storage_database', status: 'unavailable' }
        ]
      ]);
      expect(result.summary).toMatchObject({
        measured_iterations: 3,
        successful_iterations: 3,
        failed_iterations: 0,
        boundaries: {
          storage_write: { sample_count: 3 }
        },
        counters: {
          source_rows: { sample_count: 3, min: 10_000, max: 10_000 },
          payload_bytes: { sample_count: 3, min: 2_560_000, max: 2_560_000 },
          writer_save_calls: { sample_count: 3, min: 10_000, max: 10_000 },
          bucket_operations: { sample_count: 3, min: 10_000, max: 10_000 },
          parameter_operations: { sample_count: 3, min: 0, max: 0 },
          distinct_buckets: {
            sample_count: 3,
            min: scenario.expected_bucket_count,
            max: scenario.expected_bucket_count
          }
        }
      });
    });
  }
);
