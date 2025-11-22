import { useMemo } from "react";

import SceneClusters from "../scene/components/SceneClusters.jsx";
import IncubatorScene from "../scene/modes/IncubatorScene.jsx";
import PhylogenyScene from "../scene/modes/PhylogenyScene.jsx";

export const KinshipModes = {
  PHYLOGENY: "phylogeny",
  INCUBATOR: "incubator",
  DEFAULT: "default",
};

export const KINSHIP_MODE_CONFIGS = {
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

export function selectKinshipMode({ phylogenyMode, incubatorMode }) {
  if (phylogenyMode) return KinshipModes.PHYLOGENY;
  if (incubatorMode) return KinshipModes.INCUBATOR;
  return KinshipModes.DEFAULT;
}

export function useKinshipModeSelection({ phylogenyMode, incubatorMode }) {
  return useMemo(() => {
    const modeKey = selectKinshipMode({ phylogenyMode, incubatorMode });
    return { modeKey, modeConfig: KINSHIP_MODE_CONFIGS[modeKey] };
  }, [phylogenyMode, incubatorMode]);
}
