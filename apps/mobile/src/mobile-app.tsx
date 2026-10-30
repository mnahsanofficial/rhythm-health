import { Text } from 'react-native';

// Platform entry exists before behavioral implementation, so red tests fail on
// missing user behavior rather than missing imports or an unconfigured runner.
export function MobileApp() {
  return <Text>Rhythm</Text>;
}
