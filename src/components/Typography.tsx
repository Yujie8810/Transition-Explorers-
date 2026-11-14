import { createContext, forwardRef, useContext, type ComponentRef } from 'react';
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextProps,
  type TextInputProps,
  type TextStyle,
  type StyleProp,
} from 'react-native';

export const FontsReadyContext = createContext(false);

export const fonts = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  extraBold: 'DMSans_800ExtraBold',
} as const;

// Choose the actual font face instead of asking native platforms to synthesize bold.
function fontStyle(style: StyleProp<TextStyle>): TextStyle | undefined {
  const flat = StyleSheet.flatten(style);
  if (flat?.fontFamily) return;
  const weight = flat?.fontWeight === 'bold' ? 700 : Number(flat?.fontWeight) || 400;
  const fontFamily = weight >= 800 ? fonts.extraBold
    : weight >= 700 ? fonts.bold
    : weight >= 600 ? fonts.semibold
    : weight >= 500 ? fonts.medium : fonts.regular;
  return { fontFamily, fontWeight: 'normal' };
}

export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps>(function Text({ style, ...props }, ref) {
  const ready = useContext(FontsReadyContext);
  return <NativeText {...props} ref={ref} style={[style, ready && fontStyle(style)]} />;
});

export const TextInput = forwardRef<ComponentRef<typeof NativeTextInput>, TextInputProps>(function TextInput({ style, ...props }, ref) {
  const ready = useContext(FontsReadyContext);
  return <NativeTextInput {...props} ref={ref} style={[style, ready && fontStyle(style)]} />;
});
