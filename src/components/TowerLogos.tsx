"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CityBuilding } from "@/lib/github";

const LOGO_SIZE = 80;
const FLOAT_OFFSET = 100;
const SPIN_SPEED = 0.3;

const DISTRICT_LOGOS: Record<string, string> = {
  empreender:
    "https://empreender.nyc3.digitaloceanspaces.com/landingpage/688cf51938fb3.png",
  nuvemshop:
    "https://empreender.nyc3.digitaloceanspaces.com/landingpage/6823a9b518c5b.png",
  googleanalytics4:
    "https://empreender.nyc3.digitaloceanspaces.com/landingpage/688a7cf10c973.png",
  meta: "https://empreender.nyc3.digitaloceanspaces.com/landingpage/68d59e00a9272.png",
  yampi:
    "https://empreender.nyc3.digitaloceanspaces.com/landingpage/689cbec11b503.png",
  lojaintegrada:
    "https://empreender.nyc3.digitaloceanspaces.com/landingpage/68c0881c5ef9b.png",
  tiktokshop:
    "https://empreender.nyc3.digitaloceanspaces.com/landingpage/68f92c7db0284.png",
  tray: "https://empreender.nyc3.digitaloceanspaces.com/landingpage/68ee872faa496.png",
  shopify:
    "https://empreender.nyc3.digitaloceanspaces.com/landingpage/690bb1c08272b.png",
  bling:
    "https://empreender.nyc3.digitaloceanspaces.com/landingpage/69371751ac146.svg%2Bxml",
  kiwify:
    "https://empreender.nyc3.digitaloceanspaces.com/landingpage/6995f61b69bd7.png",
  montink:
    "https://empreender.nyc3.digitaloceanspaces.com/landingpage/682b70efbb509.png",
};

const _loader = new THREE.TextureLoader();

function useLogoTexture(districtId: string | undefined) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const texRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    if (!districtId) return;
    const url = DISTRICT_LOGOS[districtId];
    if (!url) return;
    let cancelled = false;

    const apply = (tex: THREE.Texture) => {
      if (cancelled) {
        tex.dispose();
        return;
      }
      if (texRef.current) texRef.current.dispose();
      texRef.current = tex;
      setTexture(tex);
    };

    _loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        apply(tex);
      },
      undefined,
      () => {
        if (!cancelled) setTexture(null);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [districtId]);

  useEffect(() => {
    return () => {
      if (texRef.current) {
        texRef.current.dispose();
        texRef.current = null;
      }
    };
  }, []);

  return texture;
}

function SpinningLogo({ building }: { building: CityBuilding }) {
  const groupRef = useRef<THREE.Group>(null);
  const tex = useLogoTexture(building.district ?? undefined);

  const material = useMemo(() => {
    if (!tex) return null;
    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
  }, [tex]);

  useEffect(() => {
    return () => {
      material?.dispose();
    };
  }, [material]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += SPIN_SPEED * delta;
    }
  });

  if (!material) return null;

  return (
    <group
      ref={groupRef}
      position={[
        building.position[0],
        building.height + FLOAT_OFFSET,
        building.position[2],
      ]}
    >
      <mesh>
        <planeGeometry args={[LOGO_SIZE, LOGO_SIZE]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  );
}

interface TowerLogosProps {
  buildings: CityBuilding[];
}

export default function TowerLogos({ buildings }: TowerLogosProps) {
  const towers = useMemo(
    () => buildings.filter((b) => b.login.startsWith("tower-")),
    [buildings],
  );

  return (
    <>
      {towers.map((b) => (
        <SpinningLogo key={b.login} building={b} />
      ))}
    </>
  );
}
