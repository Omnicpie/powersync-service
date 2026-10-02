import { ControlledCombinedBenchmarkImplementation } from '../implementations/combined/ControlledCombinedBenchmarkImplementation.js';
import type {
  ReplicationBenchmarkSourceSelection,
  ReplicationBenchmarkStorageSelection
} from '../implementations/replication/ControlledReplicationBenchmarkImplementation.js';
import { assertDistinctMongoSourceAndStorage } from '../implementations/replication/mongodb/MongoSourceBenchmarkConfiguration.js';
import { assertDistinctPostgresSourceAndStorage } from '../implementations/replication/postgres/PostgresSourceBenchmarkConfiguration.js';
import { CombinedBenchmarkScenario } from '../types/CombinedBenchmark.js';
import { ReplicationBenchmarkProducerId } from '../types/ReplicationBenchmark.js';
import { StorageBenchmarkImplementationId } from '../types/StorageBenchmark.js';
import {
  createCategoryReplicationSyncRules,
  createCategorySyncParameters,
  createReplicationSyncRules
} from '../utils/replication-sync-rules.js';
import { mongoReplicationSource, postgresReplicationSource } from './replication-scenarios.js';

export interface CombinedBenchmarkCase {
  readonly scenario: CombinedBenchmarkScenario;
  readonly implementation: ControlledCombinedBenchmarkImplementation;
}

export function createQuickCombinedScenario(
  source: ReplicationBenchmarkProducerId,
  storage: StorageBenchmarkImplementationId,
  storageVersion: number
): CombinedBenchmarkScenario {
  return {
    id: `combined.initial.baseline.${source}.${storage}.v${storageVersion}.quick.ndjson`,
    description: `Initial snapshot from ${source} through ${storage} storage version ${storageVersion} to one NDJSON client`,
    layer: 'combined',
    profile: 'quick',
    tags: ['layer:combined', 'phase:snapshot', source, storage, `version:${storageVersion}`, 'profile:quick'],
    prerequisites: [source, storage],
    timeout_ms: 120_000,
    warmup_iterations: 1,
    measured_iterations: 3,
    producer: source,
    storage: { implementation: storage, version: storageVersion },
    mode: 'initial',
    transport: { encoding: 'ndjson', compression: 'none' },
    clients: { count: 1 },
    workload: { snapshot_row_count: 1_000, payload_bytes: 256 },
    syncRule: createReplicationSyncRules,
    sync_parameters: {},
    expected_bucket_count: 1,
    expected_bucket_operation_count: 1_000
  };
}

export function createCategoryCombinedScenario(
  source: ReplicationBenchmarkProducerId,
  storage: StorageBenchmarkImplementationId,
  storageVersion: number
): CombinedBenchmarkScenario {
  const scenario = createQuickCombinedScenario(source, storage, storageVersion);
  return {
    ...scenario,
    id: `combined.initial.buckets-10.${source}.${storage}.v${storageVersion}.quick.ndjson`,
    description: `Initial snapshot from ${source} across 10 category buckets through ${storage} storage version ${storageVersion} to one NDJSON client`,
    tags: [...scenario.tags, 'shape:10-buckets'],
    syncRule: createCategoryReplicationSyncRules,
    sync_parameters: createCategorySyncParameters(),
    expected_bucket_count: 10
  };
}

export function createQuickCombinedCases(
  storage: ReplicationBenchmarkStorageSelection
): readonly CombinedBenchmarkCase[] {
  const postgresSource = postgresReplicationSource();
  const mongoSource = mongoReplicationSource();
  return [
    createCombinedCase(
      postgresSource,
      storage,
      storage.id === 'storage:postgres' ? assertDistinctPostgresSourceAndStorage : undefined
    ),
    createCombinedCase(
      mongoSource,
      storage,
      storage.id === 'storage:mongodb' ? assertDistinctMongoSourceAndStorage : undefined
    )
  ];
}

export function createCategoryCombinedCases(storage: ReplicationBenchmarkStorageSelection): CombinedBenchmarkCase[] {
  const postgresSource = postgresReplicationSource();
  const mongoSource = mongoReplicationSource();
  return [
    createCategoryCombinedCase(
      postgresSource,
      storage,
      storage.id === 'storage:postgres' ? assertDistinctPostgresSourceAndStorage : undefined
    ),
    createCategoryCombinedCase(
      mongoSource,
      storage,
      storage.id === 'storage:mongodb' ? assertDistinctMongoSourceAndStorage : undefined
    )
  ];
}

function createCategoryCombinedCase(
  source: ReplicationBenchmarkSourceSelection,
  storage: ReplicationBenchmarkStorageSelection,
  validateEnvironment?: (environment: Readonly<Record<string, string | undefined>>) => void
): CombinedBenchmarkCase {
  return {
    scenario: createCategoryCombinedScenario(source.id, storage.id, storage.version),
    implementation: new ControlledCombinedBenchmarkImplementation({ source, storage, validateEnvironment })
  };
}

function createCombinedCase(
  source: ReplicationBenchmarkSourceSelection,
  storage: ReplicationBenchmarkStorageSelection,
  validateEnvironment?: (environment: Readonly<Record<string, string | undefined>>) => void
): CombinedBenchmarkCase {
  return {
    scenario: createQuickCombinedScenario(source.id, storage.id, storage.version),
    implementation: new ControlledCombinedBenchmarkImplementation({ source, storage, validateEnvironment })
  };
}
