import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/benchmarks/**/*.bench.ts'],
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
    tags: [
      { name: 'profile:quick' },
      { name: 'version:1' },
      { name: 'version:2' },
      { name: 'version:3' },
      { name: 'version:4' },
      { name: 'source:postgres' },
      { name: 'source:mongodb' },
      { name: 'storage:postgres' },
      { name: 'storage:mongodb' },
      { name: 'phase:snapshot' },
      { name: 'phase:streaming' },
      { name: 'layer:api' },
      { name: 'layer:combined' },
      { name: 'layer:replication' },
      { name: 'layer:storage' },
      { name: 'shape:single-bucket' },
      { name: 'shape:10-buckets' }
    ]
  }
});
