import { StyleSheet } from 'react-native';
import { THEMES } from '@rhythm-health/brand';

type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };
export type Line = { text: string; grey: boolean; size?: number };

const flat = (node: Node): string => (node.children ?? []).map(child => typeof child === 'string' ? child : flat(child)).join('');

/** Every line of text a person can see on the screen, scrolled or not. The tab bar and the brand name aren't the screen's. */
export function visibleLines(tree: unknown, out: Line[] = []): Line[] {
  if (!tree || typeof tree === 'string') return out;
  if (Array.isArray(tree)) { tree.forEach(node => visibleLines(node, out)); return out; }
  const node = tree as Node;
  if (node.props.accessibilityRole === 'tablist') return out;
  const style = StyleSheet.flatten(node.props.style as never) as { display?: string; color?: string; fontSize?: number } | undefined;
  if (style?.display === 'none') return out;
  if (node.type === 'Text') {
    const text = flat(node);
    if (text !== 'Rhythm') out.push({ text, grey: style?.color === THEMES.light.muted, size: style?.fontSize });
    return out;
  }
  if (node.type === 'TextInput' && node.props.placeholder) out.push({ text: String(node.props.placeholder), grey: true });
  (node.children ?? []).forEach(child => { if (typeof child !== 'string') visibleLines(child, out); });
  return out;
}

/** A word has a letter in it, so scale numbers, "+8%" and "·" aren't words. */
export const countWords = (text: string) => text.split(/\s+/).filter(word => /\p{L}/u.test(word)).length;
export const wordsOn = (tree: unknown) => visibleLines(tree).reduce((total, line) => total + countWords(line.text), 0);
