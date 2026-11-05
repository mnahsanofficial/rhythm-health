import { View } from 'react-native';
import { DetailsRow } from './details-sheet';
import { Copy, useStyles } from './ui';

/** Answers "how do we know it helped?" without promising that a change will. */
export function HowWeKnow() { const styles = useStyles();
  return <DetailsRow label="How we know">
    <View testID="how-we-know" style={styles.stack}>
      <Copy>We compare your normal days with your test days.</Copy>
      <Copy>Your check-ins decide, not the AI.</Copy>
      <Copy>A change counts only if it&apos;s bigger than your normal ups and downs.</Copy>
      <Copy>If another experiment overlapped, the report says so.</Copy>
      <Copy>Ten days show a pattern, not proof.</Copy>
    </View>
  </DetailsRow>;
}
