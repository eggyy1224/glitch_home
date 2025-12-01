import { useMemo } from "react";
import type { ComponentType } from "react";
import SceneClusters from "../scene/components/SceneClusters";
import IncubatorScene from "../scene/modes/IncubatorScene";
import PhylogenyScene from "../scene/modes/PhylogenyScene";
import type { KinshipCluster, KinshipData } from "../../../types/kinship";

export const KinshipModes = {
  PHYLOGENY: "phylogeny",
  INCUBATOR: "incubator",
  DEFAULT: "default",
} as const;

export type KinshipModeKey = (typeof KinshipModes)[keyof typeof KinshipModes];

export interface KinshipModeConfig {
  cameraProps: { fov?: number; position?: [number, number, number] };
  fogDensity: number;
  ambientIntensity: number;
  directionalIntensity: number;
  orbitControls: { minDistance: number; maxDistance: number };
  pointLightProps?: Record<string, unknown>;
  SceneComponent: ComponentType<Record<string, unknown>>;
  buildSceneProps: (args: {
    imagesBase: string;
    clusters?: KinshipCluster[];
    data?: KinshipData | null;
    onPick?: (name: string) => void;
  }) => Record<string, unknown>;
}

export const KINSHIP_MODE_CONFIGS: Record<KinshipModeKey, KinshipModeConfig> = {
  [KinshipModes.PHYLOGENY]: {
    cameraProps: { fov: 50, position: [0, 0, 32] },
    fogDensity: 0.018,
    ambientIntensity: 1.1,
    directionalIntensity: 0.75,
    orbitControls: { minDistance: 10, maxDistance: 80 },
    SceneComponent: PhylogenyScene,
    buildSceneProps: ({ imagesBase, data, onPick }) => ({ imagesBase, data, onPick }),
  },
  [KinshipModes.INCUBATOR]: {
    cameraProps: { fov: 52, position: [0, 2.4, 24] },
    fogDensity: 0.026,
    ambientIntensity: 1.05,
    directionalIntensity: 0.5,
    orbitControls: { minDistance: 6, maxDistance: 48 },
    pointLightProps: { intensity: 1.2, position: [0, 3, 0], color: "#3fa9ff", distance: 42, decay: 2 },
    SceneComponent: IncubatorScene,
    buildSceneProps: ({ imagesBase, data, onPick }) => ({ imagesBase, data, onPick }),
  },
  [KinshipModes.DEFAULT]: {
    cameraProps: { fov: 55, position: [0, 1.2, 15] },
    fogDensity: 0.035,
    ambientIntensity: 0.9,
    directionalIntensity: 0.6,
    orbitControls: { minDistance: 4, maxDistance: 60 },
    SceneComponent: SceneClusters,
    buildSceneProps: ({ imagesBase, clusters = [], onPick }) => ({ imagesBase, clusters, onPick }),
  },
};

export function selectKinshipMode({
  phylogenyMode,
  incubatorMode,
}: {
  phylogenyMode?: boolean;
  incubatorMode?: boolean;
}): KinshipModeKey {
  if (phylogenyMode) return KinshipModes.PHYLOGENY;
  if (incubatorMode) return KinshipModes.INCUBATOR;
  return KinshipModes.DEFAULT;
}

export function useKinshipModeSelection({
  phylogenyMode = false,
  incubatorMode = false,
}: {
  phylogenyMode?: boolean;
  incubatorMode?: boolean;
}) {
  return useMemo(() => {
    const modeKey = selectKinshipMode({ phylogenyMode, incubatorMode });
    return { modeKey, modeConfig: KINSHIP_MODE_CONFIGS[modeKey] };
  }, [phylogenyMode, incubatorMode]);
}
