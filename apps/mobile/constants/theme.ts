import { Platform } from "react-native";

export const displayFont = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" });
export const colors = {
  ink: "#13252B",
  muted: "#646C65",
  background: "#F7F2E7",
  surface: "#FFFCF6",
  line: "#E1D9CC",
  accent: "#344F45",
  accentSoft: "#E4E9E1",
  copper: "#925A38",
  copperDecorative: "#BE8A63",
  warning: "#9A5B12",
  warningSoft: "#FFF0D7",
  danger: "#A43C3C",
  dangerSoft: "#FDE9E7",
};

export const radii = { small: 12, medium: 18, large: 28 };
