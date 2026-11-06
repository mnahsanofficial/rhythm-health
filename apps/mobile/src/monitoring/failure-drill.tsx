import { Button } from 'react-native';
import { drillEnabled } from './errors';

export function FailureDrillButton() {
  if (!drillEnabled(__DEV__, process.env.EXPO_PUBLIC_DEV_TOOLS)) return null;
  return <Button title="Trigger monitoring test error" onPress={() => {
    throw new Error('Rhythm mobile failure drill');
  }} />;
}
