'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Aircraft } from '@/lib/sim/aircraft';
function Wing({span,length,color,sweep=.2}:{span:number;length:number;color:string;sweep?:number}) {const geometry=useMemo(()=>{const shape=new THREE.Shape();shape.moveTo(-span/2,length*sweep);shape.lineTo(-span/2,length*(sweep+.13));shape.lineTo(0,length*.15);shape.lineTo(span/2,length*(sweep+.13));shape.lineTo(span/2,length*sweep);shape.lineTo(0,-length*.14);shape.closePath();return new THREE.ExtrudeGeometry(shape,{depth:.25,bevelEnabled:false});},[span,length,sweep]);return <mesh geometry={geometry} rotation={[Math.PI/2,0,0]} castShadow><meshStandardMaterial color={color}/></mesh>;}
export function AircraftModel({a,parked=false,gear=true}:{a:Aircraft;parked?:boolean;gear?:boolean}) {const l=a.length,w=a.span,r=l/(a.shape==='light'||a.shape==='glider'?15:a.shape==='fighter'?12:13);const special=['balloon','airship','paramotor'].includes(a.shape);
 if(special)return <group><mesh position={[0,a.shape==='balloon'?18:8,0]} scale={a.shape==='airship'?[w/2,w/2,l/2]:a.shape==='paramotor'?[5,1.5,2]:[9,12,9]} castShadow><sphereGeometry args={[1,16,12]}/><meshStandardMaterial color={a.color}/></mesh><mesh position={[0,2,0]}><boxGeometry args={[2,2,3]}/><meshStandardMaterial color="#aa8250"/></mesh></group>;
 return <group position={[0,r+1,0]}>
 <mesh rotation={[Math.PI/2,0,0]} scale={[1,1,1]} castShadow><capsuleGeometry args={[r,l-r*2,5,12]}/><meshStandardMaterial color={a.shape==='fighter'||a.shape==='prop'?a.color:'#edf1ee'} roughness={.65}/></mesh>
 {a.shape==='beluga'&&<mesh position={[0,r*.8,-l*.03]} scale={[r*1.45,r*1.3,l*.44]} castShadow><sphereGeometry args={[1,16,12]}/><meshStandardMaterial color="#eef4f0"/></mesh>}
 {a.shape==='jumbo'&&<mesh position={[0,r*.6,a.id==='a380'?0:-l*.22]} scale={[r*.88,r*.7,l*(a.id==='a380'?.4:.2)]} castShadow><sphereGeometry args={[1,12,10]}/><meshStandardMaterial color="#f3f3ec"/></mesh>}
 <group position={[0,a.id==='c152'?r*.8:0,0]}><Wing span={w} length={l} color="#d9e0df" sweep={a.shape==='light'||a.shape==='glider'?.02:a.shape==='fighter'?.45:.27}/></group>
 <group position={[0,.6,l*.36]}><Wing span={w*.38} length={l*.4} color={a.color} sweep={.25}/></group>
 <mesh position={[0,r+l*.055,l*.35]} rotation={[-.25,0,0]} castShadow><boxGeometry args={[.4,l*.18,l*.17]}/><meshStandardMaterial color={a.color}/></mesh>
 {a.shape==='fighter'&&[-1,1].map(side=><mesh key={side} position={[side*2,2,l*.3]} rotation={[0,0,side*.4]}><boxGeometry args={[.3,4,4]}/><meshStandardMaterial color={a.color}/></mesh>)}
 <mesh position={[0,r*.7,-l*.36]} rotation={[-.3,0,0]} scale={[r*.8,r*.35,l*.055]}><sphereGeometry args={[1,10,8]}/><meshStandardMaterial color="#254756" roughness={.2}/></mesh>
 {a.seats>10&&a.shape!=='prop'&&Array.from({length:Math.min(24,Math.floor(l/2))},(_,i)=><group key={i}>{[-1,1].map(side=><mesh key={side} position={[side*r*.97,r*.18,-l*.27+i*l*.025]}><boxGeometry args={[.12,.42,.48]}/><meshStandardMaterial color="#4c6d79"/></mesh>)}</group>)}
 {Array.from({length:a.engines},(_,i)=>{const center=a.engines===1||(a.engines===3&&i===2);const side=i%2===0?-1:1;const x=center?0:side*w*(i<2?.22:.36);const z=center?(a.engines===3?l*.36:-l*.49):-l*.015;return <group key={i} position={[x,center&&a.engines===3?r*1.7:-r*.5,z]}><mesh rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[r*.49,r*.41,l*.12,12]}/><meshStandardMaterial color={a.color}/></mesh><mesh position={[0,0,-l*.062]} rotation={[Math.PI/2,0,0]}><circleGeometry args={[r*.37,12]}/><meshStandardMaterial color="#273e47" side={THREE.DoubleSide}/></mesh>{(a.shape==='light'||a.shape==='prop')&&<mesh position={[0,0,-l*.07]}><boxGeometry args={[r*3,.15,.15]}/><meshStandardMaterial color="#354247"/></mesh>}</group>})}
 {gear&&[[-r,-r,l*.09],[r,-r,l*.09],[0,-r,-l*.3]].map((p,i)=><mesh key={i} position={p as [number,number,number]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[Math.max(.25,r*.26),Math.max(.25,r*.26),.4,8]}/><meshStandardMaterial color="#253239"/></mesh>)}
 {!parked&&<mesh position={[0,-r-.8,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[w*.65,w*.65+.45,64]}/><meshBasicMaterial color="#59e5bd" transparent opacity={.8}/></mesh>}
 </group>;
}
