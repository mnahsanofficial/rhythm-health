import Svg, { Circle, Path } from 'react-native-svg';
import { useColors } from './theme-core';

const PATHS = {
  today: ['M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4'],
  progress: ['M5 20V11M12 20V4M19 20v-6'],
  ask: ['M12 5v14M5 12h14'],
  history: ['M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 4v4.5H8M12 7.5V12l3 2'],
  you: ['M5 20a7 7 0 0 1 14 0'],
  sleep: ['M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z'],
  hours: ['M4 18v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6M4 15h16M7 10V7h10v3'],
  move: ['M3 12h4l2.5-6 4 12 2.5-6h5'],
  goals: ['M12 3v18M12 4h7l-2 3 2 3h-7'],
  habits: ['M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5'],
  limits: ['M12 3l7 3v6c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V6l7-3Z'],
  age: ['M5 6h14v14H5zM5 10h14M9 3.5V7M15 3.5V7'],
  bell: ['M6 17V11a6 6 0 1 1 12 0v6l1.5 1.5h-15L6 17ZM10 21h4'],
  example: ['M10 3h4M11 3v6l-5.5 9.5A1.7 1.7 0 0 0 7 21h10a1.7 1.7 0 0 0 1.5-2.5L13 9V3M8 15h8'],
  signOut: ['M10 4H5v16h5M15 8l4 4-4 4M19 12H9'],
  chevron: ['M9 6l6 6-6 6'],
  chevronDown: ['M6 9l6 6 6-6'],
  minus: ['M6 12h12'],
  plus: ['M12 6v12M6 12h12'],
} as const;
export type IconName = keyof typeof PATHS;

/** Our own small set, drawn in one stroke weight. Always decorative: the control beside it carries the name. */
export function Icon({ name, size = 24, color, filled = false }: { name: IconName; size?: number; color?: string; filled?: boolean }) {
  const COLORS = useColors();
  const tone = color ?? COLORS.text;
  const stroke = { stroke: tone, strokeWidth: filled ? 2.25 : 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {name === 'today' && <Circle cx={12} cy={12} r={4} {...stroke} fill={filled ? tone : 'none'} />}
    {name === 'you' && <Circle cx={12} cy={8} r={4} {...stroke} fill={filled ? tone : 'none'} />}
    {PATHS[name].map(d => <Path key={d} d={d} {...stroke} />)}
  </Svg>;
}
