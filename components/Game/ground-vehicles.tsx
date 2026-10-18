'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { FlightState } from '@/lib/sim/engine';
import { type VehicleKind, vehicleLabels } from '@/lib/sim/ground';
function Box({p,size,color}:{p:[number,number,number];size:[number,number,number];color:string}){return <mesh position={p} castShadow><boxGeometry args={size}/><meshStandardMaterial color={color}/></mesh>}
export function VehicleModel({kind}:{kind:VehicleKind}){
 const bus=kind==='bus',trailer=kind==='baggage',small=['tug','gpu','belt','stairs','operations'].includes(kind);
 const l=bus?11:small?4.5:7,w=bus?2.8:2.4;
 const color=kind==='fire'?'#c44d3e':kind==='fuel'?'#d2b660':kind==='operations'?'#d0a541':kind==='water'?'#6c9db6':'#dbe3d9';
 return <group><Box p={[0,1,0]} size={[w,1,l]} color={color}/><Box p={[0,2,-l*.32]} size={[w,1.8,small?1.7:2.3]} color={color}/><Box p={[0,2.4,-l*.32-1.17]} size={[w*.85,.75,.08]} color="#395967"/>
 {bus&&<><Box p={[0,2.2,1.1]} size={[w,2.8,8.5]} color={color}/>{Array.from({length:6},(_,i)=><group key={i}><Box p={[-1.42,2.8,-2+i*1.2]} size={[.04,.95,.95]} color="#42626c"/><Box p={[1.42,2.8,-2+i*1.2]} size={[.04,.95,.95]} color="#42626c"/></group>)}</>}
 {['fuel','water','lavatory'].includes(kind)&&<mesh position={[0,2.25,1.2]} rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[1.15,1.15,4.2,12]}/><meshStandardMaterial color={kind==='water'?'#98b7c8':kind==='lavatory'?'#9caaa5':'#dbd9bb'}/></mesh>}
 {['fire','ambulance','maintenance','gpu'].includes(kind)&&<Box p={[0,2,1]} size={[w,2,l*.5]} color={color}/>}
 {kind==='ambulance'&&<><Box p={[1.22,2.4,1]} size={[.04,.35,1.25]} color="#c5554b"/><Box p={[1.24,2.4,1]} size={[.04,1.25,.35]} color="#c5554b"/></>}
 {['fire','ambulance','operations'].includes(kind)&&<Box p={[0,3.1,-l*.32]} size={[1.2,.25,.35]} color={kind==='operations'?'#ecb448':'#6b9be1'}/>}
 {kind==='stairs'&&<group position={[0,1,1]}>{Array.from({length:8},(_,i)=><Box key={i} p={[0,i*.45,i*.5-2]} size={[1.6,.22,.55]} color="#c8d5d1"/>)}<Line points={[[-.9,1,-2],[-.9,4.8,1.7],[.9,4.8,1.7],[.9,1,-2]]} color="#e2bc5d" lineWidth={1.5}/></group>}
 {kind==='belt'&&<group position={[0,1.8,0]} rotation={[-.3,0,0]}><Box p={[0,0,0]} size={[1.5,.3,7]} color="#3f514c"/><Box p={[0,-.3,0]} size={[1.8,.2,7]} color="#d6b557"/></group>}
 {trailer&&[5,9,13].map(z=><group key={z}><Box p={[0,.7,z]} size={[2.5,.35,3]} color="#94a3a2"/><Box p={[0,1.5,z]} size={[2,1.2,2.5]} color="#607d84"/><Box p={[0,.6,z-2]} size={[.2,.2,2]} color="#9ba8a5"/>{[-1,1].map(side=><mesh key={side} position={[side*1.3,.5,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.45,.45,.3,8]}/><meshStandardMaterial color="#253238"/></mesh>)}</group>)}
 {[-1,1].flatMap(side=>[-1,1].map(end=><mesh key={`${side}${end}`} position={[side*(w/2+.12),.55,end*l*.3]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.55,.55,.35,10]}/><meshStandardMaterial color="#253238"/></mesh>))}
 </group>;
}
function MovingVehicle({id,kind,sim}:{id:string;kind:VehicleKind;sim:React.RefObject<FlightState>}){const ref=useRef<THREE.Group>(null);useFrame(()=>{const v=sim.current.ground.vehicles.find(v=>v.id===id);if(v&&ref.current){ref.current.position.set(v.x,.5,v.z);ref.current.rotation.y=-v.heading;}});return <group ref={ref} name={vehicleLabels[kind]}><VehicleModel kind={kind}/></group>}
export function GroundVehicles({sim}:{sim:React.RefObject<FlightState>}){return <group>{sim.current.ground.vehicles.map(v=><MovingVehicle key={`${v.id}-${v.kind}`} id={v.id} kind={v.kind} sim={sim}/>)}{[-1,1].flatMap(side=>[0,1,2].map(i=><group key={`${side}-${i}`} position={[-400+i*22,.5,225+side*34]}><Box p={[0,.15,0]} size={[1.5,.3,1.5]} color="#e3ddbd"/><mesh position={[0,.9,0]}><coneGeometry args={[.55,1.5,6]}/><meshStandardMaterial color="#df944a"/></mesh></group>))}</group>}
