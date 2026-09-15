import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Print from "expo-print";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { StickyFooter } from "@/components/Screen";
import { Badge, Button, Card, Field, IconButton, Section, Text } from "@/components/ui";
import { deleteReport, getReport, keepPhoto, removePhotoFile, reportHtml, saveReport, type ConditionReport } from "@/features/condition";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";

export default function ConditionReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const [r, setR] = useState<ConditionReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [newRoom, setNewRoom] = useState("");

  useEffect(() => {
    getReport(String(id)).then(setR);
  }, [id]);

  const update = (next: ConditionReport) => {
    setR(next);
    void saveReport(next);
  };

  if (!r) return null;

  const capture = async (roomId: string) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Camera access needed", "Allow camera access in Settings.");
    const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, exif: false });
    if (shot.canceled) return;
    let coords: { lat: number; lng: number } | undefined;
    try {
      const loc = await Location.getForegroundPermissionsAsync();
      if (loc.granted) {
        const pos = await Location.getLastKnownPositionAsync();
        if (pos) coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch {
      coords = undefined;
    }
    const item = await keepPhoto(r.id, shot.assets[0].uri, coords);
    update({ ...r, rooms: r.rooms.map((room) => (room.id === roomId ? { ...room, items: [...room.items, item] } : room)) });
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      const html = await reportHtml(r);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: r.title, UTI: "com.adobe.pdf" });
      }
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  const total = r.rooms.reduce((a, x) => a + x.items.length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <Stack.Screen
        options={{
          title: r.kind === "move-in" ? "Move-in report" : "Move-out report",
          headerRight: () => (
            <IconButton
              name="trash-outline"
              label="Delete report"
              tone={t.c.alert}
              onPress={() =>
                Alert.alert("Delete this report?", "Photos are removed from this phone.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => deleteReport(r.id).then(() => router.back()) },
                ])
              }
            />
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
        <Section>
          <Field label="Address" value={r.address} onChangeText={(address) => update({ ...r, address })} />
          <Field label="Landlord or agent" value={r.landlord} onChangeText={(landlord) => update({ ...r, landlord })} />
        </Section>
        {r.rooms.map((room) => (
          <Section
            key={room.id}
            title={room.name}
            action={<Badge label={`${room.items.length} photo${room.items.length === 1 ? "" : "s"}`} tone={room.items.length ? "success" : "neutral"} />}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {room.items.map((it) => (
                <View key={it.id} style={{ width: 140, gap: 4 }}>
                  <Image source={{ uri: it.uri }} style={{ width: 140, height: 105, borderRadius: 10 }} contentFit="cover" />
                  <Text variant="small" tone="ink3">{new Date(it.takenAt).toLocaleString()}</Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    label="Remove"
                    onPress={() => {
                      removePhotoFile(it.uri);
                      update({ ...r, rooms: r.rooms.map((x) => (x.id === room.id ? { ...x, items: x.items.filter((y) => y.id !== it.id) } : x)) });
                    }}
                  />
                </View>
              ))}
              <Card style={{ width: 140, height: 105, alignItems: "center", justifyContent: "center" }}>
                <IconButton name="camera" label={`Photograph ${room.name}`} onPress={() => void capture(room.id)} />
                <Text variant="small" tone="ink3">Add photo</Text>
              </Card>
            </ScrollView>
            <Field
              label="Notes (scratches, stains, what’s broken)"
              value={room.notes}
              multiline
              onChangeText={(notes) => update({ ...r, rooms: r.rooms.map((x) => (x.id === room.id ? { ...x, notes } : x)) })}
            />
          </Section>
        ))}
        <Section title="Add a room">
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end" }}>
            <Field label="Room name" value={newRoom} onChangeText={setNewRoom} style={{ flex: 1 }} />
            <Button
              label="Add"
              disabled={!newRoom.trim()}
              onPress={() => {
                update({ ...r, rooms: [...r.rooms, { id: `${Date.now()}`, name: newRoom.trim(), items: [], notes: "" }] });
                setNewRoom("");
              }}
            />
          </View>
        </Section>
      </ScrollView>
      <StickyFooter>
        <Button label={`Export PDF · ${total} photos`} icon="share-outline" disabled={!total} loading={busy} onPress={exportPdf} />
      </StickyFooter>
    </View>
  );
}
