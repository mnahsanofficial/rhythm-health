import Constants, { ExecutionEnvironment } from 'expo-constants';
import { startErrorReporting } from './errors';

startErrorReporting(process.env.EXPO_PUBLIC_SENTRY_DSN,
  // Load only with a DSN; native modules stay untouched when reporting is disabled.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('@sentry/react-native'),
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
  Constants.expoConfig?.extra?.monitoringRelease,
  process.env.EXPO_PUBLIC_APP_ENVIRONMENT ?? (__DEV__ ? 'development' : 'production'));
