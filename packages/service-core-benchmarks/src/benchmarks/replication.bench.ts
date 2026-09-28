import { randomUUID } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { assertDistinctMongoSourceAndStorage } from '../implementations/replication/mongodb/MongoSourceBenchmarkConfiguration.js';
import { assertDistinctPostgresSourceAndStorage } from '../implementations/replication/postgres/PostgresSourceBenchmarkConfiguration.js';
import { NodeProcessResourceMonitor } from '../monitors/NodeProcessResourceMonitor.js';
import { UnavailableResourceMonitor } from '../monitors/UnavailableResourceMonitor.js';
import { ReplicationBenchmark } from '../runner/ReplicationBenchmark.js';
import {
  mongoReplicationStorage,
  mongoSourceCase,
  mongoSourceCategoryCase,
  postgresReplicationStorage,
  postgresSourceCase
} from '../scenarios/replication-scenarios.js';
import {
  MONGO_STORAGE_BENCHMARK_VERSIONS,
  POSTGRES_STORAGE_BENCHMARK_VERSIONS
} from '../scenarios/storage-versions.js';
import { writeBenchmarkResult } from '../utils/output.js';

const cases = [
  ...POSTGRES_STORAGE_BENCHMARK_VERSIONS.flatMap((version) => {
    const storage = postgresReplicationStorage(version);
    return [
      mongoSourceCategoryCase(storage),
      mongoSourceCase('snapshot', storage),
      mongoSourceCase('streaming', storage),
      postgresSourceCase(storage, assertDistinctPostgresSourceAndStorage)
    ];
  }),
  ...MONGO_STORAGE_BENCHMARK_VERSIONS.flatMap((version) => {
    const storage = mongoReplicationStorage(version);
    return [
      mongoSourceCategoryCase(storage, assertDistinctMongoSourceAndStorage),
      mongoSourceCase('snapshot', storage, assertDistinctMongoSourceAndStorage),
      mongoSourceCase('streaming', storage, assertDistinctMongoSourceAndStorage),
      postgresSourceCase(storage)
    ];
  })
];

describe.each(cases)('$scenario.id', ({ scenario, implementation }) => {
  test('runs', { timeout: scenario.timeout_ms, sequential: true, tags: scenario.tags }, async () => {
    const benchmark = new ReplicationBenchmark(scenario, implementation, {
      runId: randomUUID(),
      monitors: [
        new NodeProcessResourceMonitor(),
        implementation.createServiceMonitor(),
        new UnavailableResourceMonitor('storage_database', 'Database resource monitoring is not implemented')
      ],
      signal: AbortSignal.timeout(scenario.timeout_ms - 10_000)
    });

    const result = await benchmark.run();
    await writeBenchmarkResult(result);

    expect(result.status, JSON.stringify(result, null, 2)).toBe('passed');
    expect(result.iterations).toHaveLength(scenario.warmup_iterations + scenario.measured_iterations);
    expect(result.iterations.every((iteration) => iteration.status === 'passed')).toBe(true);
    expect(result.iterations.filter((iteration) => iteration.kind === 'measured')).toHaveLength(
      scenario.measured_iterations
    );
  });
});
