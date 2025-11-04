import React from "react";

import ClusterFlower from "./ClusterFlower.jsx";

export default function SceneClusters({ imagesBase, clusters = [], onPick }) {
  return (
    <>
      {clusters.map((cluster) => (
        <ClusterFlower key={cluster.id} cluster={cluster} imagesBase={imagesBase} onPick={onPick} />
      ))}
    </>
  );
}
