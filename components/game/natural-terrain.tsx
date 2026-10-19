'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import { airportList, distanceMeters } from '@/lib/sim/airports';
/** No roads, urban objects or third-party assets between airports. Deterministic instancing. */
export default function NaturalTerrain(){
 const trees=useMemo(()=>{
  const placements:{x:number;z:number;size:number}[]=[];
  let seed=53471;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<850;i++){
   const x=-43000+random()*70000,z=-19000+random()*65000;
   if(airportList.some(a=>distanceMeters({x,z},a.world)<2500))continue;
   placements.push({x,z,size:3+random()*5});
  }
  return placements;
 },[]);
 const trunk=useMemo(()=>{const mesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.4,.7,1,5),new THREE.MeshStandardMaterial({color:'#666a4d',roughness:1}),trees.length);
  const matrix=new THREE.Matrix4();trees.forEach((t,i)=>{matrix.compose(new THREE.Vector3(t.x,t.size*.5,t.z),new THREE.Quaternion(),new THREE.Vector3(1,t.size,1));mesh.setMatrixAt(i,matrix);});mesh.instanceMatrix.needsUpdate=true;return mesh;
 },[trees]);
 const foliage=useMemo(()=>{const mesh=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,6),new THREE.MeshStandardMaterial({color:'#628563',roughness:1}),trees.length);
  const matrix=new THREE.Matrix4();trees.forEach((t,i)=>{const width=t.size*.95,height=t.size*2;matrix.compose(new THREE.Vector3(t.x,t.size+height*.45,t.z),new THREE.Quaternion(),new THREE.Vector3(width,height,width));mesh.setMatrixAt(i,matrix);});mesh.instanceMatrix.needsUpdate=true;return mesh;
 },[trees]);
 const grass=useMemo(()=>{const mesh=new THREE.InstancedMesh(new THREE.CircleGeometry(1,10),new THREE.MeshBasicMaterial({color:'#7d9b72',transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-3}),100);
  let seed=45003;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
  for(let i=0;i<100;i++){
   let x=0,z=0,scale=0;
   // Avoid even the edges of the large decorative grass patches reaching runways.
   for(let attempts=0;attempts<50;attempts++){
    x=-38000+random()*64000;z=-16000+random()*57000;scale=250+random()*750;
    if(airportList.every(a=>distanceMeters({x,z},a.world)>scale+2300))break;
   }
   matrix.compose(new THREE.Vector3(x,.18,z),rotation,new THREE.Vector3(scale,scale,1));mesh.setMatrixAt(i,matrix);
  }mesh.instanceMatrix.needsUpdate=true;return mesh;
 },[]);
 return <group>
  <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[96000,96000]}/><meshStandardMaterial color="#88a47b" roughness={1}/></mesh>
  <primitive object={grass}/><primitive object={trunk}/><primitive object={foliage}/>
 </group>;
}
