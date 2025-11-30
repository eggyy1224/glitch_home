import React from "react";

import { KinshipCluster, KinshipOnPick } from "../../../../types/kinship";
import ClusterFlower from "./ClusterFlower";

interface SceneClustersProps {
  imagesBase: string;
  clusters?: KinshipCluster[];
  onPick?: KinshipOnPick;
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
