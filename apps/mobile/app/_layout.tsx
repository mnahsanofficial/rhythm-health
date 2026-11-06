import '../src/monitoring/init';
import { Stack } from 'expo-router';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../src/theme';

function ThemedStatusBar() {
  return <StatusBar style={useTheme().scheme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <ThemedStatusBar />
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
