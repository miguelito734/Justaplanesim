'use client';
import { useEffect,useMemo,useRef,useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerrainStream,selectTiles,tile,type TileData } from '@/lib/world/terrain';
import { destination,ecefToLocal,worldToGeo } from '@/lib/world/geodesy';
import { ecefRotation,type RenderFrame } from '@/lib/world/render';
import type { FlightState } from '@/lib/sim/engine';
function Chunk({data,frame}:{data:TileData;frame:React.RefObject<RenderFrame>}) {
 const ref=useRef<THREE.Mesh>(null),version=useRef(-1);
 const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data.positions,3));g.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));g.setAttribute('color',new THREE.BufferAttribute(data.colors,3));g.setIndex(new THREE.BufferAttribute(data.indices,1));g.computeBoundingSphere();return g;},[data]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 useFrame(()=>{if(ref.current&&version.current!==frame.current.revision){version.current=frame.current.revision;const p=ecefToLocal(data.center,frame.current.origin);ref.current.position.set(p.x,p.y,p.z);ref.current.quaternion.setFromRotationMatrix(ecefRotation(frame.current.origin));}},-1);
 return <mesh ref={ref} geometry={geometry} receiveShadow><meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide}/></mesh>;
}
export default function StreamingTerrain({sim,frame,quality}:{sim:React.RefObject<FlightState>;frame:React.RefObject<RenderFrame>;quality:boolean}) {
 const budget=quality?174:102;
 const stream=useMemo(()=>{const s=new TerrainStream(budget);s.request(Array.from({length:6},(_,i)=>tile(i,0,0,0)));s.pump(6);return s;},[budget]);
 const [revision,setRevision]=useState(0),timer=useRef(1);

 useFrame((_,dt)=>{
  timer.current+=dt;
  if(timer.current>=.5&&!stream.queued){timer.current=0;const s=sim.current,p=worldToGeo(s);stream.request(selectTiles(p,s.y,budget,destination(p,s.heading,Math.min(20000,s.speed*30))));}
  if(stream.pump(1))setRevision(v=>v+1);
 });
 return <group name={`terrain-generation-${revision}`}>{stream.active.map(t=><Chunk key={t.key} data={stream.cache.get(t.key)!} frame={frame}/>)}</group>;
}
