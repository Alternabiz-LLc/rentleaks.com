/**
 * Primitives. Small on purpose — every screen composes these, so the design
 * system lives in one file and dark mode is never an afterthought.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { font, radius, space, type as typeScale } from "@/theme/tokens";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export function Icon({ name, size = 20, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Ionicons name={name} size={size} color={color ?? t.c.ink} style={style} />;
}

type Variant = keyof typeof typeScale;
type Tone = "ink" | "ink2" | "ink3" | "brand" | "value" | "success" | "alert" | "warn" | "onBrand";

export function Text({
  variant = "body",
  tone = "ink",
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const t = useTheme();
  return <RNText {...rest} style={[typeScale[variant], { color: t.c[tone] }, style]} />;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  size = "md",
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "value";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const bg = {
    primary: t.c.brand,
    secondary: t.c.surface,
    ghost: "transparent",
    danger: t.c.alertSoft,
    value: t.c.valueSoft,
  }[variant];
  const fg = {
    primary: t.c.onBrand,
    secondary: t.c.ink,
    ghost: t.c.brand,
    danger: t.c.alert,
    value: t.c.value,
  }[variant];
  const pad = size === "sm" ? 8 : size === "lg" ? 16 : 12;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: variant === "primary" && pressed ? t.c.brandPressed : bg,
          borderRadius: radius.full,
          paddingVertical: pad,
          paddingHorizontal: size === "sm" ? 14 : 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: disabled ? 0.45 : pressed && variant !== "primary" ? 0.7 : 1,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: t.c.lineStrong,
          minHeight: size === "sm" ? 36 : 46,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={size === "sm" ? 16 : 18} color={fg} /> : null}
      <RNText style={{ fontFamily: font.semibold, fontSize: size === "sm" ? 13 : 15, color: fg }}>{label}</RNText>
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  active,
  tone,
  size = 22,
  style,
}: {
  name: IconName;
  onPress?: () => void;
  label: string;
  active?: boolean;
  tone?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      hitSlop={10}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.c.surface,
          borderWidth: 1,
          borderColor: t.c.line,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Icon name={name} size={size} color={tone ?? (active ? t.c.value : t.c.ink)} />
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  tone,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  tone?: "value";
}) {
  const t = useTheme();
  const on = selected ? (tone === "value" ? t.c.value : t.c.ink) : t.c.surface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: radius.full,
        backgroundColor: on,
        borderWidth: 1,
        borderColor: selected ? on : t.c.line,
        opacity: pressed ? 0.75 : 1,
        maxWidth: "100%",
      })}
    >
      {icon ? <Icon name={icon} size={15} color={selected ? t.c.bg : t.c.ink2} /> : null}
      <RNText style={{ fontFamily: font.medium, fontSize: 13, color: selected ? t.c.bg : t.c.ink2, flexShrink: 1 }}>{label}</RNText>
    </Pressable>
  );
}

export function Badge({ label, tone = "neutral", icon }: { label: string; tone?: "neutral" | "brand" | "value" | "success" | "alert" | "warn"; icon?: IconName }) {
  const t = useTheme();
  const map = {
    neutral: [t.c.surfaceAlt, t.c.ink2],
    brand: [t.c.brandSoft, t.c.brand],
    value: [t.c.valueSoft, t.c.value],
    success: [t.c.successSoft, t.c.success],
    alert: [t.c.alertSoft, t.c.alert],
    warn: [t.c.warnSoft, t.c.warn],
  }[tone];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: map[0], borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" }}>
      {icon ? <Icon name={icon} size={12} color={map[1]} /> : null}
      <RNText style={{ fontFamily: font.semibold, fontSize: 11, color: map[1] }}>{label}</RNText>
    </View>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.c.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: t.c.line,
          padding: padded ? space.lg : 0,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Section({ title, kicker, action, children, style }: { title?: string; kicker?: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: space.md }, style]}>
      {title || kicker ? (
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            {kicker ? <Text variant="micro" tone="ink3">{kicker}</Text> : null}
            {title ? <Text variant="h2">{title}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ height: 1, backgroundColor: t.c.line }, style]} />;
}

export function Field({
  label,
  hint,
  error,
  style,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const t = useTheme();
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Text variant="label" tone="ink2">{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.c.ink3}
        {...input}
        style={{
          fontFamily: font.body,
          fontSize: 16,
          color: t.c.ink,
          backgroundColor: t.c.surface,
          borderWidth: 1,
          borderColor: error ? t.c.alert : t.c.lineStrong,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          paddingVertical: input.multiline ? 12 : 12,
          minHeight: input.multiline ? 120 : 48,
          textAlignVertical: input.multiline ? "top" : "center",
        }}
      />
      {error ? <Text variant="small" tone="alert">{error}</Text> : hint ? <Text variant="small" tone="ink3">{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: t.c.surfaceAlt, borderRadius: radius.full, padding: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: radius.full,
              backgroundColor: on ? t.c.surface : "transparent",
              alignItems: "center",
            }}
          >
            <RNText style={{ fontFamily: on ? font.semibold : font.medium, fontSize: 13, color: on ? t.c.ink : t.c.ink3 }}>{o.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Row({ label, value, tone, onPress, icon, last }: { label: string; value?: string; tone?: Tone; onPress?: () => void; icon?: IconName; last?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.c.line,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {icon ? <Icon name={icon} size={20} color={t.c.ink2} /> : null}
      <Text style={{ flex: 1 }} tone={tone ?? "ink"}>{label}</Text>
      {value ? <Text tone="ink3" variant="small">{value}</Text> : null}
      {onPress ? <Icon name="chevron-forward" size={18} color={t.c.ink3} /> : null}
    </Pressable>
  );
}

/** A whole-row checkbox: the label is the target, not a 51-pt switch. */
export function CheckRow({ checked, onChange, children, accessibilityLabel }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; accessibilityLabel: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onChange(!checked);
      }}
      style={({ pressed }) => ({ flexDirection: "row", gap: space.md, alignItems: "flex-start", opacity: pressed ? 0.7 : 1, paddingVertical: 4 })}
    >
      <Icon name={checked ? "checkbox" : "square-outline"} size={26} color={checked ? t.c.brand : t.c.ink3} />
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: space.xxxl, paddingHorizontal: space.xl, gap: space.md }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.c.brandSoft, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={28} color={t.c.brand} />
      </View>
      <Text variant="h2" style={{ textAlign: "center" }}>{title}</Text>
      {body ? <Text tone="ink3" style={{ textAlign: "center" }}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Couldn’t load this"
      body={message}
      action={onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : undefined}
    />
  );
}

export function Skeleton({ height = 16, width = "100%", radius: r = 8, style }: { height?: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ height, width, borderRadius: r, backgroundColor: t.c.surfaceAlt }, style]} />;
}

export function Notice({ tone = "brand", icon, title, body, children }: { tone?: "brand" | "value" | "alert" | "success" | "warn"; icon?: IconName; title: string; body?: string; children?: ReactNode }) {
  const t = useTheme();
  const [bg, fg] = {
    brand: [t.c.brandSoft, t.c.brand],
    value: [t.c.valueSoft, t.c.value],
    alert: [t.c.alertSoft, t.c.alert],
    success: [t.c.successSoft, t.c.success],
    warn: [t.c.warnSoft, t.c.warn],
  }[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.md, padding: space.md, flexDirection: "row", gap: space.md }}>
      <Icon name={icon ?? "information-circle"} size={20} color={fg} />
      <View style={{ flex: 1, gap: 4 }}>
        <RNText style={{ fontFamily: font.semibold, fontSize: 14, color: fg }}>{title}</RNText>
        {body ? <Text variant="small" tone="ink2">{body}</Text> : null}
        {children}
      </View>
    </View>
  );
}

export function PressableCard(props: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { style, children, ...rest } = props;
  return (
    <Pressable {...rest} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }, style]}>
      {children}
    </Pressable>
  );
}
