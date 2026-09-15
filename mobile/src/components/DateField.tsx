import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { fromIso, shortDate, toIso } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { Button, Icon, Text } from "./ui";

/**
 * A date as ISO text (YYYY-MM-DD) — the exact format the server compares
 * lexicographically. Native wheel/calendar on each platform.
 */
export function DateField({
  label,
  value,
  onChange,
  minimum,
  placeholder = "Choose a date",
  clearable,
}: {
  label: string;
  value?: string;
  onChange: (iso: string | undefined) => void;
  minimum?: string;
  placeholder?: string;
  clearable?: boolean;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ? fromIso(value) : minimum ? fromIso(minimum) : new Date());

  const onPick = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === "android") {
      setOpen(false);
      if (e.type === "set" && d) onChange(toIso(d));
      return;
    }
    if (d) setDraft(d);
  };

  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text variant="micro" tone="ink3">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? shortDate(value) : placeholder}`}
        onPress={() => {
          setDraft(value ? fromIso(value) : minimum ? fromIso(minimum) : new Date());
          setOpen(true);
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderWidth: 1,
          borderColor: t.c.lineStrong,
          borderRadius: radius.md,
          paddingHorizontal: 12,
          minHeight: 48,
          backgroundColor: t.c.surface,
        }}
      >
        <Icon name="calendar-outline" size={18} color={t.c.ink2} />
        <Text style={{ flex: 1 }} tone={value ? "ink" : "ink3"}>{value ? shortDate(value) : placeholder}</Text>
        {clearable && value ? (
          <Pressable hitSlop={10} accessibilityLabel={`Clear ${label}`} onPress={() => onChange(undefined)}>
            <Icon name="close-circle" size={18} color={t.c.ink3} />
          </Pressable>
        ) : null}
      </Pressable>

      {open && Platform.OS === "android" ? (
        <DateTimePicker value={draft} mode="date" minimumDate={minimum ? fromIso(minimum) : undefined} onChange={onPick} />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: t.c.overlay, justifyContent: "flex-end" }} onPress={() => setOpen(false)}>
            <Pressable style={{ backgroundColor: t.c.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.lg, gap: space.md }}>
              <Text variant="h2">{label}</Text>
              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                themeVariant={t.dark ? "dark" : "light"}
                accentColor={t.c.brand}
                minimumDate={minimum ? fromIso(minimum) : undefined}
                onChange={onPick}
              />
              <Button
                label="Done"
                onPress={() => {
                  onChange(toIso(draft));
                  setOpen(false);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
