import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Line, useTexture } from "@react-three/drei";

import {
  KIND_COLORS,
  PHYLO_LEVEL_GAP,
  PHYLO_NODE_BASE_SIZE,
  PHYLO_NODE_SPACING,
} from "../../utils/constants.js";
import { buildLineageGraph } from "../../utils/graph.js";
import { computePhylogenyLayout } from "../../utils/layouts.js";

function PhylogenyNode({ node, imagesBase, onPick }) {
  const url = `${imagesBase}${node.name}`;
  const tex = useTexture(url);
  const sizeMultiplier = node.kind === "original" ? 1.2 : 1;
  const size = PHYLO_NODE_BASE_SIZE * sizeMultiplier;
  const frameSize = size * 1.1;
  const color = KIND_COLORS[node.kind] || "#d0d0d0";
  const frameRef = useRef();
  const imageRef = useRef();
  const [scales, setScales] = useState({
    frame: [frameSize, frameSize, 1],
    image: [size, size, 1],
  });

  useEffect(() => {
    if (!tex.image) return;
    const width = tex.image.width || 1;
    const height = tex.image.height || 1;
    const aspect = width / height || 1;
    const imageScale = [size, size / aspect, 1];
    const frameScale = [frameSize, frameSize / aspect, 1];
    setScales({ frame: frameScale, image: imageScale });
    if (frameRef.current) frameRef.current.scale.set(...frameScale);
    if (imageRef.current) imageRef.current.scale.set(...imageScale);
  }, [tex.image, size, frameSize]);

  return (
    <group position={node.position.toArray()}>
      <Billboard follow>
        <group>
          <mesh ref={frameRef} position={[0, 0, -0.02]} scale={scales.frame}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color={color} transparent opacity={0.9} />
          </mesh>
          <mesh
            ref={imageRef}
            onClick={() => onPick?.(node.name)}
            onPointerOver={() => (document.body.style.cursor = "pointer")}
            onPointerOut={() => (document.body.style.cursor = "default")}
            scale={scales.image}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={tex} toneMapped={false} />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
}

function PhylogenyAutoFrame({ width, height }) {
  const { camera, size, controls } = useThree((state) => ({
    camera: state.camera,
    size: state.size,
    controls: state.controls,
  }));

  useEffect(() => {
    if (!camera?.isPerspectiveCamera) return;
    if (!width || !height) return;

    const aspect = size.width / Math.max(size.height, 1);
    const verticalFov = (camera.fov * Math.PI) / 180;
    const paddingFactor = 1.15;
    const paddedHeight = height * paddingFactor;
    const paddedWidth = width * paddingFactor;

    const distanceForHeight = (paddedHeight / 2) / Math.tan(verticalFov / 2);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
    const distanceForWidth = (paddedWidth / 2) / Math.tan(horizontalFov / 2);
    const targetDistance = Math.max(distanceForHeight, distanceForWidth) + 2;

    camera.position.set(0, 0, targetDistance);
    camera.near = Math.max(0.1, targetDistance / 100);
    camera.far = targetDistance * 10;
    camera.updateProjectionMatrix();

    if (controls) {
      controls.target.set(0, 0, 0);
      controls.minDistance = targetDistance * 0.25;
      controls.maxDistance = targetDistance * 3.0;
      controls.update();
    }
  }, [camera, controls, width, height, size.width, size.height]);

  return null;
}

function PhylogenyAnimatedWrapper({ children }) {
  const groupRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const group = groupRef.current;
    if (!group) return;
    const slow = t * 0.12;
    group.rotation.y = slow;
    group.rotation.x = Math.sin(t * 0.18) * 0.08;
    group.position.y = Math.sin(t * 0.22) * 0.6;
  });

  return <group ref={groupRef}>{children}</group>;
}

export default function PhylogenyScene({ imagesBase, data, onPick }) {
  const graph = useMemo(() => buildLineageGraph(data), [data]);
  const layout = useMemo(() => computePhylogenyLayout(graph), [graph]);

  if (!layout.nodes.length) {
    return null;
  }

  const paddingX = PHYLO_NODE_SPACING * 2.2;
  const paddingY = PHYLO_LEVEL_GAP * 1.8;
  const width = Math.max(layout.bounds?.width || 0, PHYLO_NODE_SPACING * 4) + paddingX;
  const height = Math.max(layout.bounds?.height || 0, PHYLO_LEVEL_GAP * 2) + paddingY;

  return (
    <PhylogenyAnimatedWrapper>
      <PhylogenyAutoFrame width={width} height={height} />
      <mesh position={[0, 0, -0.08]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#090909" transparent opacity={0.55} />
      </mesh>
      {layout.edges.map((edge) => (
        <Line
          key={`${edge.source.name}->${edge.target.name}`}
          points={[
            edge.source.position.toArray(),
            edge.target.position.toArray(),
          ]}
          color="#9aa0a6"
          lineWidth={2}
          depthTest={false}
          opacity={0.45}
          transparent
        />
      ))}
      {layout.nodes.map((node) => (
        <PhylogenyNode key={node.name} node={node} imagesBase={imagesBase} onPick={onPick} />
      ))}
    </PhylogenyAnimatedWrapper>
  );
}
