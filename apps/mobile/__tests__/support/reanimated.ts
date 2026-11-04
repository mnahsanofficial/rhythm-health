import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

/**
 * Reanimated's own Jest mock needs native modules at import in this setup. Motion isn't what these
 * tests check, so animated values land on their final state straight away.
 */
export const ReduceMotion = { System: 'system', Always: 'always', Never: 'never' } as const;
export const Easing = { bezier: () => (value: number) => value };
export const useSharedValue = <T,>(initial: T) => useMemo(() => ({ value: initial }), []); // eslint-disable-line react-hooks/exhaustive-deps
export const useAnimatedStyle = <T,>(build: () => T) => build();
export const withTiming = <T,>(value: T) => value;
export const useReducedMotion = () => false;
const Animated = { View, Text, ScrollView, createAnimatedComponent: <T,>(component: T) => component };
export default Animated;
