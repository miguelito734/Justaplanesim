'use client';
import { useEffect, useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { airports } from '@/lib/sim/airports';
import { aircraft } from '@/lib/sim/aircraft';
import { AircraftModel } from './aircraft-model';

const cgh=airports.SBSP;
function Block({p,size,color}:{p:[number,number,number];size:[number,number,number];color:string}){
 const flat = size[1] <= .4 && size[0] >= .5 && size[2] >= .5;
 const marking = flat && size[1] <= .06;
 return <mesh position={p} castShadow={!flat} receiveShadow={!flat}>
  <boxGeometry args={size}/>
  <meshStandardMaterial color={color} roughness={.88} polygonOffset={marking} polygonOffsetFactor={marking?-2:0} polygonOffsetUnits={marking?-3:0}/>
 </mesh>;
}
function Marking({text,p,width=25}:{text:string;p:[number,number,number];width?:number}){
 const texture=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,512,128);ctx.font='bold 82px monospace';ctx.textAlign='center';ctx.fillStyle='#e9ecdd';ctx.fillText(text,256,91);return new THREE.CanvasTexture(canvas);},[text]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <mesh position={p} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[width,7]}/><meshBasicMaterial transparent map={texture} depthWrite={false}/></mesh>;
}
function RunwayVisual({index}:{index:number}){
 const r=cgh.runways[index], x=r.center.x-cgh.world.x,z=r.center.z-cgh.world.z;
 return <group position={[x,0,z]} rotation={[0,r.rotation,0]}>
  {/* The single airport grass base already underlies the runways; avoid overlapping ground slabs. */}
  <Block p={[0,.31,0]} size={[r.width,.24,r.length]} color="#424c51"/>
  {[-r.width/2+1,r.width/2-1].map(edge=><Block key={edge} p={[edge,.49,0]} size={[.55,.025,r.length-36]} color="#f1ead6"/>)}
  {Array.from({length:Math.floor(r.length/62)},(_,i)=><Block key={i} p={[0,.49,-r.length/2+42+i*62]} size={[1.25,.025,28]} color="#efeee0"/>)}
  {[-1,1].map(end=><group key={end} position={[0,0,end*(r.length/2-55)]} rotation={[0,end<0?Math.PI:0,0]}>
    {[-14,-10,-6,6,10,14].map(dx=><Block key={dx} p={[dx,.51,0]} size={[2,.025,23]} color="#e8e9db"/>)}
    <Marking text={end===1?r.ends[1]:r.ends[0]} p={[0,.54,end*30]} width={27}/>
  </group>)}
  {Array.from({length:Math.floor(r.length/52)},(_,i)=>[-1,1].map(side=><mesh key={`${i}-${side}`} position={[side*(r.width/2+1),.65,-r.length/2+i*52]}><sphereGeometry args={[.65,5,4]}/><meshBasicMaterial color={side>0?'#ffda86':'#f3f6cc'}/></mesh>))}
 </group>;
}
function Taxiway({x,z,length,width=23,rotation=0}:{x:number;z:number;length:number;width?:number;rotation?:number}){
 return <group position={[x,.36,z]} rotation={[0,rotation,0]}>
  <Block p={[0,0,0]} size={[width,.24,length]} color="#686f69"/>
  <Block p={[0,.19,0]} size={[.75,.025,length-8]} color="#e8c763"/>
 </group>;
}
export default function CongonhasAirport(){return <group position={[cgh.world.x,0,cgh.world.z]}>
 {/* Raised airport grass, with no coplanar terrain surfaces. */}
 <Block p={[-110,.16,0]} size={[1250,.28,2550]} color="#859c78"/>
 <RunwayVisual index={0}/><RunwayVisual index={1}/>
 {/* Align the entire apron complex to runway 17R/35L; the original layout
     used global axes, cutting across the angled runway. */}
 <group position={[-95,0,0]} rotation={[0,cgh.runway.rotation,0]}>
  {/* Only the west-side parallel taxiway, with short paved connections to the apron. */}
  <Taxiway x={-92} z={0} length={1730} width={18}/>
  {[-625,-310,35,380,630].map(z=><Taxiway key={z} x={-155} z={z} length={150} width={18} rotation={Math.PI/2}/>)}
  {/* Terminal apron remains entirely west of the runway. */}
  <Block p={[-330,.40,0]} size={[260,.20,800]} color="#999e98"/>
  {/* Terminal, piers, gate markings and service buildings. */}
  <Block p={[-468,10,10]} size={[72,20,515]} color="#cbd5d1"/>
  <Block p={[-468,21,10]} size={[78,3,524]} color="#e2e4da"/>
  <Block p={[-428,7,10]} size={[5,9,498]} color="#47768a"/>
  {Array.from({length:17},(_,i)=>{
   const z=-228+i*29;
   return <group key={i}>
    <Block p={[-429,8,z]} size={[29,5,6]} color="#d6e0db"/>
    <Block p={[-405,5.4,z+4]} size={[21,4,8]} color="#96adb3"/>
    <Line points={[[ -388,.57,z-13],[-319,.57,z-13],[-319,.57,z+13],[-388,.57,z+13]]} color="#e5ddab" lineWidth={1}/>
    <Marking text={`${i+1}`} p={[-315,.65,z+13]} width={11}/>
   </group>;
  })}
  <Block p={[-562,8,-310]} size={[95,16,100]} color="#c7cfc7"/>
  <Block p={[-562,17,-310]} size={[100,2,103]} color="#9fb1ae"/>
  <Block p={[-565,8,315]} size={[95,16,85]} color="#c7cfc7"/>
  <Block p={[-565,17,315]} size={[102,2,90]} color="#9fb1ae"/>
  <Block p={[-455,20,-255]} size={[16,40,16]} color="#d5ded9"/>
  <Block p={[-455,45,-255]} size={[30,10,30]} color="#3a7088"/>
  <Block p={[-455,51,-255]} size={[35,2,35]} color="#d3dbd9"/>
  {Array.from({length:6},(_,i)=><group key={i} position={[-356,.9,-230+i*87]} rotation={[0,Math.PI/2,0]}>
   {i!==5&&<AircraftModel a={aircraft[[4,5,10,8,6][i%5]]} parked/>}
  </group>)}
  {Array.from({length:10},(_,i)=>{
   const z=-350+i*75;
   return <group key={i}>
    <Block p={[-305,.65,z]} size={[1,.03,15]} color="#e6c45c"/>
    <Block p={[-410,6,z+8]} size={[.6,12,.6]} color="#cbd5d4"/>
    <Block p={[-410,12,z+8]} size={[10,1,1.2]} color="#f2df9c"/>
   </group>;
  })}
  <Marking text="SBSP · CONGONHAS" p={[-346,.70,-364]} width={85}/>
  {/* Sparse low-poly trees outside the apron, terminal and runway protection. */}
  {Array.from({length:24},(_,i)=>{
   const side=i%2===0?-1:1;
   const x=side<0?-740-(i%3)*33:340+(i%3)*40;
   const z=-970+Math.floor(i/2)*174;
   const h=10+(i*7)%9;
   return <group key={i} position={[x,0,z]}>
    <mesh position={[0,h*.27,0]} castShadow><cylinderGeometry args={[.6,1,h*.54,5]}/><meshStandardMaterial color="#726448" roughness={1}/></mesh>
    <mesh position={[0,h*.8,0]} castShadow><coneGeometry args={[h*.48,h*1.2,5]}/><meshStandardMaterial color={['#587b51','#6b885b','#527452'][i%3]} roughness={1}/></mesh>
   </group>;
  })}
 </group>
 </group>}
