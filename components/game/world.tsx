'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
type OrbitType = React.ComponentRef<typeof OrbitControls>;
import { AircraftModel } from './aircraft-model';
import { aircraft, type Aircraft } from '@/lib/sim/aircraft';
import { airports, airportForPoint, type AirportId } from '@/lib/sim/airports';
import CongonhasAirport from './congonhas-airport';
import NaturalTerrain from './natural-terrain';
import StreamingTerrain from './streaming-terrain';
import { worldToGeo,toECEF,ecefToLocal,localToECEF,surfaceDistance,EARTH_RADIUS,GRU,type GeoPoint } from '@/lib/world/geodesy';
import { aircraftRenderPosition,tangentQuaternion,visibleAirports,vector,type RenderFrame } from '@/lib/world/render';
import type { Airport } from '@/lib/sim/airports';
import { GroundVehicles } from './ground-vehicles';
import { buildings, step, type FlightState, type Controls } from '@/lib/sim/engine';
export type CameraMode='overview'|'follow'|'close';
function Block({p,s,color='#aab4af'}:{p:[number,number,number];s:[number,number,number];color?:string}){
 // Paved surfaces must not cast self-shadows. A small depth offset stabilizes
 // low-profile runway markings at the long camera distances used by the sim.
 const flat = s[1] <= .4 && s[0] >= .5 && s[2] >= .5;
 const marking = flat && s[1] <= .06;
 return <mesh position={p} castShadow={!flat} receiveShadow={!flat}>
  <boxGeometry args={s}/>
  <meshStandardMaterial color={color} roughness={.9} polygonOffset={marking} polygonOffsetFactor={marking?-2:0} polygonOffsetUnits={marking?-3:0}/>
 </mesh>;
}
function GroundLabel({text,position,size=18,color='#edf1d8',rotation=0}:{text:string;position:[number,number,number];size?:number;color?:string;rotation?:number}){const texture=useMemo(()=>{const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.font='bold 72px monospace';ctx.textAlign='center';ctx.fillText(text,256,90);return new THREE.CanvasTexture(c);},[text,color]);useEffect(()=>()=>texture.dispose(),[texture]);return <mesh position={position} rotation={[-Math.PI/2,0,rotation]}><planeGeometry args={[size*4,size]}/><meshBasicMaterial map={texture} transparent depthWrite={false}/></mesh>}
function GuarulhosAirport(){return <group>
 <Block p={[-250,.07,0]} s={[1050,.12,2050]} color="#8fa07d"/>
 {[-140,140].map((x,i)=><group key={x}>
 <Block p={[x,.25,0]} s={[52,.3,1900]} color="#919b90"/>
 <Block p={[x,.5,0]} s={[40,.4,1840]} color="#515d5a"/>
 {[-19,19].map(dx=><Block key={dx} p={[x+dx,.75,0]} s={[.65,.03,1800]} color="#d3d8ca"/>)}
 {Array.from({length:28},(_,j)=><Block key={j} p={[x,.75,-810+j*60]} s={[1.4,.04,26]} color="#e2e5da"/>)}
 {[-1,1].map(end=><group key={end}>{[-14,-10,-6,6,10,14].map(dx=><Block key={dx} p={[x+dx,.8,end*865]} s={[2,.05,33]} color="#e1e5d7"/>)}<GroundLabel text={end===1?(i?'10L':'10R'):(i?'28R':'28L')} position={[x,.9,end*812]} size={10} rotation={end===1?0:Math.PI}/></group>)}
 <Block p={[x-65,.3,0]} s={[20,.2,1750]} color="#727d71"/>
 <Line points={[[x-65,.6,-870],[x-65,.6,870]]} color="#d7bc63" lineWidth={1}/>
 {[-720,-400,0,400,720].map(z=><group key={z}><Block p={[x-32,.4,z]} s={[65,.2,20]} color="#727d71"/><Line points={[[x-65,.7,z],[x,.7,z]]} color="#d7bc63" lineWidth={1}/></group>)}
 {Array.from({length:48},(_,j)=><mesh key={j} position={[x-22,1,-900+j*38]}><sphereGeometry args={[.8,4,4]}/><meshBasicMaterial color="#f5e4ae"/></mesh>)}
 </group>)}
 <Block p={[-325,.35,0]} s={[235,.3,750]} color="#a3aa9b"/>
 {[-400,400].map(z=><group key={z}><Block p={[-165,.4,z]} s={[370,.3,24]} color="#7b8579"/><Line points={[[-340,.7,z],[75,.7,z]]} color="#d7bd62" lineWidth={1}/></group>)}
 {Array.from({length:9},(_,i)=>{const z=-300+i*75;return <group key={i}>
 <Line points={[[-405,.8,z-28],[-305,.8,z-28],[-305,.8,z+28],[-405,.8,z+28]]} color="#d2cfa8" lineWidth={1}/>
 <Line points={[[-365,.8,z],[-235,.8,z]]} color="#ddc46b" lineWidth={1}/>
 <Block p={[-425,7,z]} s={[38,6,7]} color="#c9d0c2"/>
 <Block p={[-405,5,z+7]} s={[8,7,18]} color="#bac5bd"/>
 <GroundLabel text={`G${i+1}`} position={[-302,1,z+17]} size={7} color="#e2daaf"/>
 {i!==7&&i%2===0&&<group position={[-356,.8,z]} rotation={[0,Math.PI/2,0]}><AircraftModel a={aircraft[[4,5,10,8,6][Math.floor(i/2)]]} parked/></group>}
 </group>})}
 {buildings.map((b,i)=><group key={i}><Block p={[b.x,b.h/2,b.z]} s={[b.w,b.h,b.d]} color={i===3?'#d6d4bf':'#d7d9cc'}/><Block p={[b.x,b.h+1,b.z]} s={[b.w+4,2,b.d+4]} color="#bdc9c1"/>{i===0&&Array.from({length:18},(_,j)=><Block key={j} p={[b.x+33,13,-250+j*29]} s={[.6,12,22]} color="#5f8890"/>)}{i===3&&<><Block p={[b.x,b.h-6,b.z]} s={[35,12,35]} color="#466976"/><Block p={[b.x,b.h+1,b.z]} s={[39,3,39]} color="#e3e2d2"/></>}</group>)}
 <GroundLabel text="TERMINAL 2" position={[-470,26,0]} size={17} rotation={Math.PI/2}/>
 <GroundLabel text="CARGA" position={[-650,34,-500]} size={18}/>
 <GroundLabel text="MANUTENÇÃO" position={[-650,32,470]} size={12}/>
 <Block p={[-550,.35,0]} s={[22,.2,1600]} color="#687971"/>
 {Array.from({length:25},(_,i)=><Block key={i} p={[-550,.5,-770+i*65]} s={[1,.1,22]} color="#d9dbbb"/>)}
 {Array.from({length:42},(_,i)=>{const x=-620-(i%6)*21,z=-260+Math.floor(i/6)*61;return <Block key={i} p={[x,2,z]} s={[8,4,16]} color={['#e1ddc9','#74898b','#b5b7a4','#4a6266'][i%4]}/>})}
 {Array.from({length:65},(_,i)=>{const x=i<35?330+(i%4)*43:-870-(i%3)*45,z=-1050+(i*137)%2100;return <group key={i} position={[x,0,z]}><Block p={[0,4,0]} s={[2,8,2]} color="#7a7756"/><mesh position={[0,13,0]} castShadow><coneGeometry args={[8+(i%3)*2,22,5]}/><meshStandardMaterial color={['#526e56','#607d5b','#6b845d'][i%3]}/></mesh></group>})}
 {[[-380,310],[-390,-210],[-285,100],[-570,590]].map(([x,z],i)=><group key={i}><Block p={[x,2,z]} s={[5,4,10]} color="#dbbb58"/><Block p={[x,4,z-2]} s={[4,2,4]} color="#355766"/></group>)}
 <Line points={[[-340,1,210],[-245,1,210],[-205,1,260],[-205,1,400],[75,1,400],[75,1,720],[140,1,720]]} color="#9bc9a5" lineWidth={1.5} dashed dashSize={9} gapSize={7}/>
 </group>}
type SimulationProps={a:Aircraft;sim:React.RefObject<FlightState>;controls:React.RefObject<Controls>;running:boolean;onTick:()=>void;cameraMode:CameraMode;cameraVersion:number;zoom:number;airportId:AirportId};
function AirportPad(){
 const geometry=useMemo(()=>{const positions:number[]=[],indices:number[]=[],radii=[0,2500,3000,3500,4000,4500];
  radii.forEach((r,j)=>{const b=Math.max(0,Math.min(1,(r-2500)/2000)),y=(Math.sqrt(EARTH_RADIUS**2-r*r)-EARTH_RADIUS)*b*b*(3-2*b)+.015;
   for(let i=0;i<=64;i++){const angle=i/64*Math.PI*2;positions.push(Math.cos(angle)*r,y,Math.sin(angle)*r);if(j&&i<64){const a=j*65+i,c=a-65;indices.push(a,c,a+1,a+1,c,c+1);}}});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
 },[]);useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <mesh geometry={geometry} receiveShadow><meshStandardMaterial color="#88a47b" roughness={1} side={THREE.DoubleSide}/></mesh>;
}
function SchematicAirport(){return <group><Block p={[0,.3,0]} s={[45,.4,2000]} color="#515d5a"/><Block p={[-200,.2,225]} s={[400,.2,200]} color="#929c90"/>{Array.from({length:32},(_,i)=><Block key={i} p={[0,.55,-950+i*60]} s={[1.5,.03,28]} color="#eeeeda"/>)}<GroundLabel text="PISTA DE TESTE" position={[0,.7,800]} size={8}/><GroundLabel text="CENÁRIO APROXIMADO" position={[-250,.5,225]} size={12}/></group>}
function Anchor({point,frame,children}:{point:GeoPoint;frame:React.RefObject<RenderFrame>;children:React.ReactNode}){
 const ref=useRef<THREE.Group>(null),version=useRef(-1);
 useFrame(()=>{if(ref.current&&version.current!==frame.current.revision){version.current=frame.current.revision;const p=ecefToLocal(toECEF(point),frame.current.origin);ref.current.position.set(p.x,p.y,p.z);ref.current.quaternion.copy(tangentQuaternion(point,frame.current.origin));}},-1);
 return <group ref={ref}>{children}</group>;
}
function Airports({sim,frame}:{sim:React.RefObject<FlightState>;frame:React.RefObject<RenderFrame>}){
 const [near,setNear]=useState<Airport[]>(()=>visibleAirports(worldToGeo(sim.current))),timer=useRef(0);
 useFrame((_,dt)=>{timer.current+=dt;if(timer.current>1){timer.current=0;const next=visibleAirports(worldToGeo(sim.current));setNear(old=>old.map(a=>a.id).join()===next.map(a=>a.id).join()?old:next);}});
 return <>{near.map(a=><Anchor key={a.id} point={a} frame={frame}><AirportPad/>{a.id==='SBGR'?<GuarulhosAirport/>:a.id==='SBSP'?<group position={[-a.world.x,0,-a.world.z]}><CongonhasAirport/></group>:<SchematicAirport/>}</Anchor>)}{near.some(a=>a.id==='SBGR'||a.id==='SBSP')&&<Anchor point={GRU} frame={frame}><NaturalTerrain/></Anchor>}</>;
}
function Simulation({a,sim,controls,running,onTick,cameraMode,cameraVersion,zoom,airportId,frame}:SimulationProps&{frame:React.RefObject<RenderFrame>}){
 const model=useRef<THREE.Group>(null),orbit=useRef<OrbitType>(null),accumulator=useRef(0),publish=useRef(0);const {camera}=useThree();
 useEffect(()=>{const s=sim.current;frame.current={origin:worldToGeo(s),revision:frame.current.revision+1};const target=aircraftRenderPosition(cameraMode==='overview'?{...airportForPoint(s).world,y:0}:s,frame.current.origin),d=cameraMode==='overview'?1330:cameraMode==='close'?Math.max(70,a.span*3):380;
  camera.position.copy(target).add(new THREE.Vector3(d,d*1.1,d));orbit.current?.target.copy(target);orbit.current?.update();
 },[cameraMode,cameraVersion,a,sim,camera,airportId,frame]);
 useEffect(()=>{const target=orbit.current?.target;if(target){camera.position.sub(target).multiplyScalar(zoom).add(target);orbit.current?.update();}},[zoom,camera]);
 useFrame((_,delta)=>{
  if(running){accumulator.current+=Math.min(delta,.1);while(accumulator.current>=1/60){step(sim.current,a,controls.current,1/60);accumulator.current-=1/60;}}
  const s=sim.current,geo=worldToGeo(s);
  if(surfaceDistance(frame.current.origin,geo)>16000){const old=frame.current.origin,c=localToECEF(camera.position,old),target=orbit.current?localToECEF(orbit.current.target,old):toECEF(geo);frame.current={origin:geo,revision:frame.current.revision+1};camera.position.copy(vector(ecefToLocal(c,geo)));orbit.current?.target.copy(vector(ecefToLocal(target,geo)));}
  const position=aircraftRenderPosition(s,frame.current.origin);
  if(model.current){model.current.position.copy(position);model.current.quaternion.copy(tangentQuaternion(geo,frame.current.origin)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(s.pitch,-s.heading,s.bank,'YXZ')));}
  if(cameraMode!=='overview'&&orbit.current){camera.position.add(position.clone().sub(orbit.current.target));orbit.current.target.copy(position);orbit.current.update();}
  publish.current+=delta;if(publish.current>.1){publish.current=0;onTick();}
 },-2);
 return <><group ref={model}><group position={[0,1,0]}><AircraftModel a={a} gear={sim.current.gear}/></group></group><GroundVehicles sim={sim} frame={frame}/><OrbitControls ref={orbit} makeDefault enableDamping minDistance={25} maxDistance={6000} maxPolarAngle={Math.PI*.47} minPolarAngle={.15} mouseButtons={{LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE}}/></>;
}
function Scene(props:SimulationProps&{quality:boolean}){const frame=useRef<RenderFrame>({origin:worldToGeo(props.sim.current),revision:0});return <><StreamingTerrain sim={props.sim} frame={frame} quality={props.quality}/><Airports sim={props.sim} frame={frame}/><Simulation {...props} frame={frame}/></>}
export default function World(props:SimulationProps&{quality:boolean}){
 const [compact,setCompact]=useState(false);useEffect(()=>{const media=window.matchMedia('(max-width: 768px)'),update=()=>setCompact(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);const quality=props.quality&&!compact;
 return <Canvas shadows={quality} dpr={quality?[1,1.5]:1} camera={{position:[1350,1550,1650],fov:42,near:.5,far:20000000}} gl={{antialias:true,logarithmicDepthBuffer:true}}><color attach="background" args={['#bad4e4']}/><fog attach="fog" args={['#bad4e4',25000,110000]}/><ambientLight intensity={.65}/><hemisphereLight args={['#e8eee8','#8c9871',.8]}/><directionalLight position={[-1000,1800,600]} intensity={2} castShadow={quality} shadow-mapSize={[2048,2048]} shadow-camera-left={-1300} shadow-camera-right={1300} shadow-camera-top={1300} shadow-camera-bottom={-1300} shadow-camera-far={5000} shadow-bias={-.0005}/><Scene {...props} quality={quality}/></Canvas>;
}
