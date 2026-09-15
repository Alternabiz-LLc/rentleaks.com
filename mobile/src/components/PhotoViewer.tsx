import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, StatusBar, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GalleryItem } from "@/api/types";
import { Icon, Text } from "./ui";

/**
 * Full-screen gallery. Swipe between photos, pinch to zoom (native ScrollView
 * zoom on iOS; Android gets swipe and captions), tap the corner to close.
 */
export function PhotoViewer({ items, index, onClose }: { items: GalleryItem[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index ?? 0);
  const listRef = useRef<FlatList<GalleryItem>>(null);
  const open = index != null;

  useEffect(() => {
    if (open) setCurrent(index);
  }, [open, index]);

  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <FlatList
          ref={listRef}
          horizontal
          pagingEnabled
          data={items}
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(g, i) => `${g.src}-${i}`}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <ScrollView
              style={{ width, height }}
              contentContainerStyle={{ width, height, justifyContent: "center" }}
              maximumZoomScale={3}
              minimumZoomScale={1}
              bouncesZoom
              centerContent
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              <Image
                source={{ uri: item.kind === "video" ? item.poster ?? item.src : item.src }}
                style={{ width, height: height * 0.8 }}
                contentFit="contain"
                accessibilityLabel={item.alt}
              />
            </ScrollView>
          )}
        />
        <View style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close photos" hitSlop={12} onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
            <Icon name="close" size={22} color="#fff" />
          </Pressable>
          <Text variant="label" style={{ color: "#fff" }}>{current + 1} / {items.length}</Text>
        </View>
        {items[current]?.caption ? (
          <View style={{ position: "absolute", bottom: insets.bottom + 16, left: 16, right: 16 }}>
            <Text variant="small" style={{ color: "rgba(255,255,255,0.85)", textAlign: "center" }}>{items[current].caption}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
