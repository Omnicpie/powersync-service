import { utils } from '@powersync/lib-services-framework';

export const databaseUrlDefaults = {
  PG_STORAGE_TEST_URL: 'postgres://postgres:postgres@localhost:5432/powersync_storage_test',
  MONGO_TEST_URL: 'mongodb://localhost:27017/powersync_test'
} as const;

export const env = utils.collectEnvironmentVariables({
  PG_STORAGE_TEST_URL: utils.type.string.default(databaseUrlDefaults.PG_STORAGE_TEST_URL),
  MONGO_TEST_URL: utils.type.string.default(databaseUrlDefaults.MONGO_TEST_URL),
  BENCHMARK_POSTGRES_SOURCE_URL: utils.type.string.optional(),
  BENCHMARK_POSTGRES_STORAGE_URL: utils.type.string.optional(),
  BENCHMARK_MONGODB_SOURCE_URL: utils.type.string.optional(),
  BENCHMARK_MONGODB_STORAGE_URL: utils.type.string.optional(),
  CI: utils.type.boolean.default('false')
});

export const fixtureEnvironment: Readonly<Record<string, string | undefined>> = {
  ...env,
  CI: String(env.CI)
};
