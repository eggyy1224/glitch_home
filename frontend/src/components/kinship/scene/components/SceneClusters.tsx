import React from "react";

import type { KinshipCluster } from "../../../../types/kinship";
import ClusterFlower from "./ClusterFlower";

interface SceneClustersProps {
  imagesBase: string;
  clusters?: KinshipCluster[];
  onPick?: (name: string | number) => void;
}

export default function SceneClusters({ imagesBase, clusters = [], onPick }: SceneClustersProps) {
  return (
    <>
      {clusters.map((cluster) => (
        <ClusterFlower key={cluster.id} cluster={cluster} imagesBase={imagesBase} onPick={onPick} />
      ))}
    </>
  );
}
