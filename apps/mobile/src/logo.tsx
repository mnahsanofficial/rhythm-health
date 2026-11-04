import Svg, { Circle, Path } from 'react-native-svg';
import { useColors } from './theme-core';

type Palette = Pick<ReturnType<typeof useColors>, 'paper' | 'ink' | 'night' | 'sun'>;

/** The web's mark: a 24-hour dial, midnight at the top, with night from 22:00 to 06:00 and a midday sun. */
export function Mark({ size, palette }: { size: number; palette?: Palette }) {
  const theme = useColors();
  const colors = palette ?? theme;
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Circle cx={12} cy={12} r={10} fill={colors.paper} stroke={colors.ink} strokeWidth={1.5} />
    <Path d="M12 12 L7.5 4.21 A9 9 0 0 1 21 12 Z" fill={colors.night} />
    <Circle cx={10.3} cy={18.3} r={2} fill={colors.sun} stroke={colors.ink} strokeWidth={0.75} />
  </Svg>;
}
