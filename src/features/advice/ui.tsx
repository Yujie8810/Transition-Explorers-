import { ReactNode } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

/**
 * Owner: Mourede.
 * Building blocks for the Find Advice screens, styled after the Figma prototype.
 * They live here (not in src/components) so the shared components stay unchanged.
 * Small text is never under 13px and uses the darkest theme colors (DP3 issue #14).
 * Every tappable element is at least 44×44 points.
 */

/** Reads a status message aloud on iOS/Android; on web the visible message uses a live region instead. */
export const announce = (message: string) => AccessibilityInfo.announceForAccessibility(message);

type ScreenProps = { eyebrow?: string; title: string; subtitle?: string; hero?: boolean; children: ReactNode };

/**
 * A scrolling page. With hero, the heading sits in a dark green band like the prototype's Ask screen.
 * The scroll view moves content above the keyboard (iOS insets; Android resizes the window itself).
 */
export function AdviceScreen({ eyebrow, title, subtitle, hero = false, children }: ScreenProps) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      <View style={hero ? styles.hero : styles.header}>
        {eyebrow ? <Text style={[styles.eyebrow, hero && styles.eyebrowHero]}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={[styles.title, hero && styles.titleHero]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, hero && styles.subtitleHero]}>{subtitle}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

/** Small uppercase heading above a group, e.g. "VOICES FROM THE FIELD". */
export function SectionLabel({ children }: { children: string }) {
  return <Text accessibilityRole="header" style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

type ButtonProps = { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'onDark' | 'onDarkQuiet' | 'danger';
  disabled?: boolean; accessibilityLabel?: string; accessibilityHint?: string };

/** Full-width button. primary = dark green, secondary = outlined, onDark* = for the dark confirmation screen. */
export function ActionButton({ label, onPress, variant = 'primary', disabled = false, accessibilityLabel, accessibilityHint }: ButtonProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label.replace(' →', '')} accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }} aria-disabled={disabled}
      style={({ pressed }) => [styles.button, buttonStyles[variant], (pressed || disabled) && { opacity: 0.6 }]}>
      <Text style={[styles.buttonText, buttonText[variant]]}>{label}</Text>
    </Pressable>
  );
}

/** An underlined text link with a full 44-point touch area. */
export function TextLink({ label, onPress, accessibilityLabel, onDark = false }:
  { label: string; onPress: () => void; accessibilityLabel?: string; onDark?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
      <Text style={[styles.linkText, onDark && styles.linkTextOnDark]}>{label}</Text>
    </Pressable>
  );
}

/** A selectable pill, used for topic filters and form choices. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" aria-checked={selected} accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, selected && styles.chipActive, pressed && { opacity: 0.7 }]}>
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

type ConfirmProps = { visible: boolean; title: string; message: string; confirmLabel: string; cancelLabel: string;
  onConfirm: () => void; onCancel: () => void; disabled?: boolean; destructive?: boolean };

/** A yes/no dialog. Built with Modal because Alert.alert does nothing on web. The safe choice is the main button. */
export function ConfirmDialog({ visible, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, disabled = false, destructive = false }: ConfirmProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!disabled) onCancel(); }}>
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityRole="alert" aria-modal accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.dialogTitle}>{title}</Text>
          <Text style={styles.dialogText}>{message}</Text>
          <ActionButton label={cancelLabel} onPress={onCancel} disabled={disabled} />
          <ActionButton variant={destructive ? 'danger' : 'secondary'} label={confirmLabel} onPress={onConfirm} disabled={disabled} />
        </View>
      </View>
    </Modal>
  );
}

/** A status bar pinned to the bottom of the screen, with an optional action such as Undo. */
export function Snackbar({ message, actionLabel, onAction }: { message: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.snackbar} accessibilityLiveRegion="polite" aria-live="polite">
      <Text style={styles.snackbarText}>{message}</Text>
      {actionLabel && onAction ? <TextLink label={actionLabel} onPress={onAction} onDark /> : null}
    </View>
  );
}

const { colors, spacing } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 96 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.sm },
  hero: { backgroundColor: colors.green, paddingHorizontal: spacing.lg, paddingTop: spacing.xl,
    paddingBottom: spacing.xl, gap: spacing.sm },
  eyebrow: { fontSize: 13, fontWeight: '700', letterSpacing: 0.8, color: colors.green },
  eyebrowHero: { color: colors.lime },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: colors.ink },
  titleHero: { fontSize: 40, lineHeight: 46, color: colors.surface },
  subtitle: { fontSize: 16, lineHeight: 23, color: colors.ink },
  subtitleHero: { color: colors.surface },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  sectionLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.8, color: colors.green, marginTop: spacing.sm },
  button: { minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: 12, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  link: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { fontSize: 15, fontWeight: '700', color: colors.green, textDecorationLine: 'underline' },
  linkTextOnDark: { color: colors.lime },
  chip: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: 999, justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.lime, borderColor: colors.green },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  chipTextActive: { color: colors.green, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(25, 46, 43, 0.6)', justifyContent: 'center', padding: spacing.lg },
  dialog: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg, gap: spacing.md },
  dialogTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.ink },
  dialogText: { fontSize: 16, lineHeight: 23, color: colors.ink },
  snackbar: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md,
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: 14, backgroundColor: colors.ink },
  snackbarText: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.surface, paddingVertical: 10 },
});

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: colors.green },
  danger: { backgroundColor: colors.danger },
  secondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.green },
  onDark: { backgroundColor: colors.lime },
  onDarkQuiet: { borderWidth: 1.5, borderColor: colors.lime },
});
const buttonText = StyleSheet.create({
  primary: { color: colors.surface },
  danger: { color: colors.surface },
  secondary: { color: colors.green },
  onDark: { color: colors.green },
  onDarkQuiet: { color: colors.surface },
});
