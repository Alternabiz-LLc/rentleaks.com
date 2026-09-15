/**
 * Web stand-in for react-native-maps, used only by `expo start --web`.
 * Draws markers on a plain grid by projecting their coordinates into the
 * view — enough to preview the layout. Phones use the real native map.
 */
import { Children, forwardRef, type ReactElement, isValidElement, useImperativeHandle, useState, type ReactNode } from "react";
import { Pressable, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";

type LatLng = { latitude: number; longitude: number };
export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };

type MarkerProps = { coordinate: LatLng; children?: ReactNode; onPress?: (e: { stopPropagation: () => void }) => void; tracksViewChanges?: boolean };
type CircleProps = { center: LatLng; radius: number; strokeColor?: string; fillColor?: string };

export function Marker(_: MarkerProps) {
  return null;
}
export function Circle(_: CircleProps) {
  return null;
}

type MapProps = {
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  children?: ReactNode;
  onPress?: () => void;
  onMapReady?: () => void;
  userInterfaceStyle?: "light" | "dark";
  showsUserLocation?: boolean;
  liteMode?: boolean;
  pointerEvents?: "none" | "auto";
};

export type MapViewHandle = { fitToCoordinates: (c: LatLng[], o?: unknown) => void };

const MapView = forwardRef<MapViewHandle, MapProps>(function MapView({ style, initialRegion, children, onPress, userInterfaceStyle }, ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useImperativeHandle(ref, () => ({ fitToCoordinates: () => {} }));
  const dark = userInterfaceStyle === "dark";

  const items = Children.toArray(children).filter(isValidElement) as Array<ReactElement<MarkerProps & CircleProps>>;
  const pts = items.map((c) => c.props.coordinate ?? c.props.center).filter(Boolean) as LatLng[];
  const lat = pts.map((p) => p.latitude);
  const lng = pts.map((p) => p.longitude);
  const r = initialRegion;
  const minLat = pts.length > 1 ? Math.min(...lat) : (r?.latitude ?? 0) - (r?.latitudeDelta ?? 0.1) / 2;
  const maxLat = pts.length > 1 ? Math.max(...lat) : (r?.latitude ?? 0) + (r?.latitudeDelta ?? 0.1) / 2;
  const minLng = pts.length > 1 ? Math.min(...lng) : (r?.longitude ?? 0) - (r?.longitudeDelta ?? 0.1) / 2;
  const maxLng = pts.length > 1 ? Math.max(...lng) : (r?.longitude ?? 0) + (r?.longitudeDelta ?? 0.1) / 2;
  const pad = 40;
  const x = (v: number) => pad + ((v - minLng) / (maxLng - minLng || 1)) * Math.max(0, size.w - pad * 2);
  const y = (v: number) => pad + ((maxLat - v) / (maxLat - minLat || 1)) * Math.max(0, size.h - pad * 2);

  return (
    <Pressable
      onPress={onPress}
      onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[
        {
          overflow: "hidden",
          backgroundColor: dark ? "#10262c" : "#e8f0ee",
          backgroundImage: `linear-gradient(${dark ? "#1b353c" : "#d6e3e0"} 1px, transparent 1px), linear-gradient(90deg, ${dark ? "#1b353c" : "#d6e3e0"} 1px, transparent 1px)`,
          backgroundSize: "36px 36px",
        } as ViewStyle,
        style,
      ]}
    >
      {size.w
        ? items.map((c, i) => {
            if (c.props.center) {
              return (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    left: size.w / 2 - 70,
                    top: size.h / 2 - 70,
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    borderWidth: 2,
                    borderColor: c.props.strokeColor,
                    backgroundColor: c.props.fillColor,
                  }}
                />
              );
            }
            const p = c.props.coordinate;
            const cx = pts.length > 1 ? x(p.longitude) : size.w / 2;
            const cy = pts.length > 1 ? y(p.latitude) : size.h / 2;
            return (
              <Pressable
                key={i}
                onPress={() => c.props.onPress?.({ stopPropagation: () => {} })}
                style={{ position: "absolute", left: cx, top: cy, transform: [{ translateX: "-50%" }, { translateY: "-50%" }] }}
              >
                {c.props.children ?? <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#3795a6", borderWidth: 3, borderColor: "#fff" }} />}
              </Pressable>
            );
          })
        : null}
    </Pressable>
  );
});

export default MapView;
