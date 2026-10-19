import { destination,geoToWorld,worldToGeo } from '../world/geodesy';
import { elevation } from '../world/elevation';
import type { Aircraft } from './aircraft';
import { updateEngine, type EngineStatus } from './commands';
import { initialGround, stepGround, groundCollision, buildings, type GroundState } from './ground';
import { airports, airportForPoint, getSpawn, isOnRunway, type AirportId, type SpawnPoint } from './airports';
import { congonhasStructures } from './airports';
export { buildings } from './ground';
export { issue, acceptReadback, type Sector, type Clearance } from './atc';
export type Controls = { pitch:number; turn:number; brake:boolean };
export type FlightState = { airportId: AirportId; x:number; y:number; z:number; speed:number; vertical:number; heading:number; pitch:number; bank:number; throttle:number; engine:EngineStatus; engineTimer:number; rpm:number; systemMessage:string; ground:GroundState; departureClearance:boolean; startupClearance:boolean; pushbackClearance:boolean; lineUpClearance:boolean; approachClearance:boolean; gear:boolean; flaps:number; fuel:number; crashed:boolean; departureChecked:boolean; airborne:boolean; landed:boolean; distance:number; elapsed:number; warning:string; clearance:boolean; landingClearance:boolean; taxiClearance:boolean; violations:number };

export function initialState(a:Aircraft,spawn:SpawnPoint='gate',airportId:AirportId='SBGR'):FlightState {
 const position=getSpawn(airportId,spawn);
 return {airportId,x:position.x,y:position.y,z:position.z,speed:spawn==='approach'?a.stall*0.5144*1.4:0,vertical:0,heading:position.heading,pitch:0,bank:0,throttle:spawn==='approach'?.34:0,engine:spawn==='approach'?'running':'off',engineTimer:0,rpm:spawn==='approach'?.5:0,systemMessage:spawn==='approach'?'Teste de aproximação: motores já estabilizados.':'Motores desligados. Use E ou o botão de partida.',ground:initialGround(airportId),departureClearance:false,startupClearance:false,pushbackClearance:false,lineUpClearance:false,approachClearance:false,gear:true,flaps:0,fuel:a.fuel*.7,crashed:false,departureChecked:spawn==='approach',airborne:spawn==='approach',landed:false,distance:0,elapsed:0,warning:'',clearance:false,landingClearance:false,taxiClearance:false,violations:0};
}
export function step(s:FlightState,a:Aircraft,c:Controls,dt:number) {
 if(a.status==='Modelo visual') return;
 if(s.airborne&&s.y<1000){const nearby=airportForPoint(s);
  if(nearby.id!==s.airportId&&Math.hypot((s.x-nearby.world.x)/(nearby.runway.chartScale??1),s.z-nearby.world.z)<3000&&!s.ground.service&&['idle','completed'].includes(s.ground.pushback.phase)){s.airportId=nearby.id;s.ground=initialGround(nearby.id);}
 }
 const groundLocked=stepGround(s,a,dt);
 if(s.crashed) return;
 updateEngine(s,a,dt);
 s.elapsed+=dt;
 if(groundLocked){s.throttle=0;s.speed=0;s.pitch=0;s.bank=0;return;}
  const groundHeight=elevation.sampleMeters(worldToGeo(s)); const ground=s.y<=groundHeight; const stall=a.stall*.5144*(1-s.flaps*.07); const mass=a.mass*.8+s.fuel;
 s.pitch+=(c.pitch*(ground?.24:.34)-s.pitch)*(1-Math.exp(-dt*2));
 s.bank+=(-c.turn*(a.shape==='fighter'?.9:.5)-s.bank)*(1-Math.exp(-dt*2));
 const turnRate=ground?Math.min(.45,5/Math.max(s.speed,1))*Math.min(1,s.speed/3):9.81*Math.tan(-s.bank)/Math.max(s.speed,15);
 s.heading+=c.turn===0&&ground?0:(ground?c.turn*turnRate:turnRate)*dt;
 const power=s.engine==='running'&&s.fuel>0?s.throttle:0;
 const drag=.5*1.225*s.speed*s.speed*(a.span*a.length*.12)*(.032+s.flaps*.012+(s.gear?.012:0)+s.pitch*s.pitch*.5);
 const rolling=ground?mass*9.81*(c.brake?.38:.018):0;
 const acceleration=(a.thrust*power-drag-rolling)/mass-(ground?0:9.81*Math.sin(s.pitch));
 s.speed=Math.max(0,Math.min(a.max*.5144*1.12,s.speed+acceleration*dt));
 const liftRatio=(s.speed/Math.max(stall,1))**2*(.4+Math.max(-.3,s.pitch)*3.7);
 if(!ground || (s.speed>stall*1.1&&s.pitch>.045)) {s.vertical+=(9.81*(Math.min(1.8,liftRatio)-1)-s.vertical*.65)*dt; s.y+=s.vertical*dt;}
 if(s.y>2) s.airborne=true;
 s.warning=s.y>2&&s.speed<stall?'ESTOL — reduza a arfagem':s.speed>a.max*.5144?'VELOCIDADE EXCESSIVA':'';
 if(s.y<groundHeight){const runway=isOnRunway(s); if(s.vertical < -5 || !s.gear || (!runway&&s.speed>20)){s.crashed=true;s.warning='Pouso inseguro — reposicione a aeronave';}else if(s.airborne){s.landed=true;if(!s.landingClearance){s.violations++;s.warning='Pouso sem autorização registrada';}}s.y=groundHeight;s.vertical=0;}
 const travel=s.speed*dt;
 const legacyLocal=[airports.SBGR,airports.SBSP].some(ap=>Math.hypot(s.x-ap.world.x,s.z-ap.world.z)<5000);
 if(legacyLocal){s.x+=Math.sin(s.heading)*travel;s.z-=Math.cos(s.heading)*travel;}
 else if(travel>0){const next=destination(worldToGeo(s),s.heading,travel);Object.assign(s,geoToWorld(next.latitude,next.longitude));s.heading=next.heading;}
 s.distance+=travel;
 const endHeight=elevation.sampleMeters(worldToGeo(s));
 if(s.y<endHeight){s.y=endHeight;s.vertical=0;s.crashed=true;s.warning='Colisão com terreno — reposicione';}
 s.fuel=Math.max(0,s.fuel-a.thrust*power*.000015*dt);
 if(s.y>2&&!s.departureChecked){s.departureChecked=true;if(!s.clearance)s.violations++;}
 for(const b of [...buildings,...congonhasStructures]) if(s.y<b.h && Math.abs(s.x-b.x)<b.w/2+a.span*.35 && Math.abs(s.z-b.z)<b.d/2+a.length*.35){s.crashed=true;s.warning='Colisão com infraestrutura — reposicione';}
 if(groundCollision(s,a)){s.crashed=true;s.warning='Colisão no pátio — reposicione a aeronave';}
 if(s.crashed){s.speed=0;s.vertical=0;s.engine='failed';s.throttle=0;}
}

