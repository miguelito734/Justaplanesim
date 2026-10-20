/** Alpha 0.6 route-following operation controller. Geometry and phases are simplified,
 * not certified autopilot, navigation, airport taxi chart, or airline flight plan. */
import type { Aircraft } from './aircraft';
import type { FlightState } from './engine';
import { airports, runwayPoint, type AirportId, type Point2 } from './airports';
import { initialGround, stepGround } from './ground';
import { serviceBusy, updateEngine } from './commands';
import { geoToWorld, worldToGeo, surfaceDistance, bearing, destination, DEG, type GeoPoint } from '../world/geodesy';
import { greatCirclePoint, generateGpsWaypoints, realFlightMinutes, modeFlightMinutes, aircraftCompatibility, type FlightMode, type FlightScope } from '../ui/flight-plan';

export type FlightPhase = 'parked'|'pushback'|'taxi_out'|'hold_short'|'lineup'|'takeoff'|'climb'|'cruise'|'descent'|'holding'|'approach'|'landing'|'taxi_in'|'completed'|'interrupted';
export const flightPhaseLabels: Record<FlightPhase, string> = {
 parked:'No pátio',pushback:'Pushback',taxi_out:'Táxi para a pista',hold_short:'Ponto de espera',lineup:'Alinhamento',
 takeoff:'Decolagem',climb:'Subida',cruise:'Cruzeiro',descent:'Descida',holding:'Órbita de espera (ATC)',
 approach:'Aproximação',landing:'Pouso e desaceleração',taxi_in:'Táxi ao portão',completed:'Voo encerrado',interrupted:'Voo interrompido',
};
export type AutonomousState = {
 from: AirportId; to: AirportId; mode: FlightMode; scope: FlightScope;
 realMinutes: number; targetMinutes: number; pushbackBudget: number; phase: FlightPhase; phaseElapsed: number;
 operationElapsed: number; phaseDuration: number; progress: number; navigatedFraction: number;
 waypointIndex: number; holdingElapsed: number; holdingFor: 'approach'|'landing'; taxiStart: Point2; approachStart: GeoPoint;
 route: GeoPoint[]; segmentLengths: number[]; cumulative: number[]; routeLength: number;
};
const MAX_DT = .1;
const NOMINAL_PUSHBACK_SECONDS = 217; // Existing G8 pushback test path; time remains an estimate.
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
const basePhases: { phase: FlightPhase; seconds: number }[] = [
 {phase:'taxi_out',seconds:85},{phase:'lineup',seconds:32},{phase:'takeoff',seconds:50},
 {phase:'climb',seconds:180},{phase:'cruise',seconds:0},{phase:'descent',seconds:180},
 {phase:'approach',seconds:100},{phase:'landing',seconds:65},{phase:'taxi_in',seconds:85},
];
const fixedTime = basePhases.reduce((sum,p)=>sum+p.seconds,0);
/** Movement durations partition the scheduled flight. Clearance waiting and ground-service
 * operations are extra real time, rather than silently consuming the aircraft's ETA. */
export function phaseSeconds(auto: AutonomousState, phase: FlightPhase): number {
 const estimated = auto.realMinutes * 60;
 const nominal = phase === 'cruise' ? Math.max(20, estimated-fixedTime) : basePhases.find(p=>p.phase===phase)?.seconds ?? 0;
 const totalNominal = fixedTime + Math.max(20, estimated-fixedTime);
 return nominal / totalNominal * Math.max(30,auto.targetMinutes * 60 - auto.pushbackBudget);
}
function pointAt(a: AutonomousState, fraction: number): GeoPoint {
 const d=clamp(fraction)*a.routeLength;
 const j=a.cumulative.findIndex((sum,i)=>i>0&&sum>=d);
 const i=j<0?a.segmentLengths.length-1:j-1;
 const local=clamp((d-a.cumulative[i])/Math.max(.0001,a.segmentLengths[i]));
 return greatCirclePoint(a.route[i],a.route[i+1],local);
}
function setGeo(s: FlightState, p: GeoPoint) {const w=geoToWorld(p.latitude,p.longitude);s.x=w.x;s.z=w.z;}
function moveLocal(s: FlightState, p: Point2, dt: number) {
 const before=worldToGeo(s),end=worldToGeo(p);
 const moved=surfaceDistance(before,end);
 if(moved>0.005){s.heading=bearing(before,end);s.x=p.x;s.z=p.z;s.distance+=moved;}
 s.speed=dt>0?Math.min(15,moved/dt):0;
}
function runwayFromLength(id:AirportId){return airports[id].runway.length;}
function runwayPosition(airportId: AirportId, lateral: number, longitudinal: number): Point2 {
 return runwayPoint(airports[airportId].runway,lateral,longitudinal);
}
function setPhase(s: FlightState, phase: FlightPhase) {
 const state=s.auto!;state.phase=phase;state.phaseElapsed=0;state.phaseDuration=phaseSeconds(state,phase);if(phase==='taxi_out')state.taxiStart={x:s.x,z:s.z};if(phase==='approach')state.approachStart=worldToGeo(s);
 s.systemMessage=`Voo autônomo: ${flightPhaseLabels[phase]}.`;
}
/** This call never applies free-flight accelerated time to career operations. */
export function configureAutonomous(s: FlightState, a: Aircraft, from: AirportId, to: AirportId, mode: FlightMode, scope: FlightScope = 'free'): string | null {
 const eligibility=aircraftCompatibility(a,from,to);
 if(!eligibility.available)return eligibility.reason;
 const real=realFlightMinutes(from,to,a);
 const target=modeFlightMinutes(real,mode,scope);
 if(real===null||target===null)return 'Não existe estimativa de duração para essa aeronave e rota.';
 const departure=runwayPosition(from,0,-airports[from].runway.length/2+160);
 const arrival=runwayPosition(to,0,airports[to].runway.length/2+3000);
 const route=[worldToGeo(departure),...generateGpsWaypoints(from,to),worldToGeo(arrival)];
 const segmentLengths=route.slice(1).map((p,i)=>surfaceDistance(route[i],p));
 const cumulative=[0];for(const d of segmentLengths)cumulative.push(cumulative[cumulative.length-1]+d);
 if(!Number.isFinite(cumulative.at(-1)) || (cumulative.at(-1) ?? 0) <= 1)return 'A rota calculada é inválida.';
 s.auto={from,to,mode,scope,realMinutes:real,targetMinutes:target,pushbackBudget:Math.min(NOMINAL_PUSHBACK_SECONDS,target*60*.15),phase:'parked',phaseElapsed:0,
  operationElapsed:0,phaseDuration:0,progress:0,navigatedFraction:0,waypointIndex:0,
  holdingElapsed:0,holdingFor:'approach',taxiStart:{x:s.x,z:s.z},approachStart:route.at(-1)!,route,segmentLengths,cumulative,routeLength:cumulative.at(-1)!};
 s.airportId=from;
 s.systemMessage='Voo autônomo armado. Solicite acionamento e pushback ao GND.';
 return null;
}
function segmentMove(s:FlightState, targetFraction:number, t:number, dt:number) {
 const auto=s.auto!,fraction=targetFraction;
 const beforeY=s.y;
 const previous=worldToGeo(s);const next=pointAt(auto,fraction);
 const meters=surfaceDistance(previous,next);if(meters>.0001){s.heading=bearing(previous,next);setGeo(s,next);s.distance+=meters;}
 auto.navigatedFraction=fraction;
 auto.waypointIndex=auto.cumulative.filter(d=>d<=fraction*auto.routeLength+1).length-1;
 s.vertical=dt>0?(s.y-beforeY)/dt:0;
}
function stageProgress(s:FlightState,dt:number,phase:FlightPhase){const auto=s.auto!;auto.phaseElapsed+=dt;auto.operationElapsed+=dt;auto.progress=clamp(auto.operationElapsed/Math.max(1,auto.targetMinutes*60-auto.pushbackBudget));return clamp(auto.phaseElapsed/Math.max(.01,auto.phaseDuration));}
function fuelBurn(s:FlightState,a:Aircraft,meters:number) {
 const rangeKm=(a.id==='c152'?320*1.852:a.id==='a320'?6200:a.id==='e195'?5556:a.id==='b777'?13650:undefined);
 // Simple energy budget: reserve remains at the end for approved dispatches; not a certified fuel model.
 const effectiveRange=Math.max(150000,(rangeKm??Math.max(s.auto?.routeLength??0,150000)/1000)*1000);
 s.fuel=Math.max(0,s.fuel-meters/effectiveRange*a.fuel);
}
function interrupt(s:FlightState, reason:string){s.crashed=true;s.throttle=0;s.speed=0;s.engine='failed';s.warning=reason;if(s.auto)setPhase(s,'interrupted');}
export function stepAutonomous(s:FlightState,a:Aircraft,dt:number) {
 if(!Number.isFinite(dt)||dt<=0)return;
 dt=Math.min(MAX_DT,dt);
 const auto=s.auto;
 // Ground services and engine transients run in real seconds, even when free flight is accelerated.
 const groundScale=s.auto?.phase==='pushback' || (s.auto?.phase==='parked' && s.ground.pushback.phase!=='idle') ? NOMINAL_PUSHBACK_SECONDS/Math.max(1,s.auto.pushbackBudget) : 1;
 const groundLocked=stepGround(s,a,dt*groundScale);
 updateEngine(s,a,dt);
 s.elapsed+=dt;
 if(!auto||s.crashed||a.status!=='Física básica')return;
 if(groundLocked) {s.throttle=0;s.speed=0;return;}
 const phase=auto.phase;
 const progressing= !['parked','pushback','hold_short','holding','completed','interrupted'].includes(phase);
 const movementDt=dt; // Target phase durations already encode free-flight compression.
 const fromAirport=airports[auto.from],toAirport=airports[auto.to];
 // Gate and pushback are always subject to existing ground-service and clearance rules.
 if(phase==='parked'||phase==='pushback'){
  s.speed=0;s.throttle=0;
  const push=s.ground.pushback.phase;
  if(phase==='parked'&&!['idle','completed'].includes(push))setPhase(s,'pushback');
  if((phase==='pushback'||phase==='parked')&&push==='completed')setPhase(s,'taxi_out');
  return;
 }
 if(phase==='hold_short'){
  s.speed=0;s.throttle=0;
  if(s.lineUpClearance&&s.engine==='running'&&!serviceBusy(s)){
   const runway=runwayPosition(auto.from,0,runwayFromLength(auto.from)/2-160);
   if(Math.hypot(s.x-runway.x,s.z-runway.z)<2){if(s.clearance)setPhase(s,'takeoff');}
   else setPhase(s,'lineup');
  }
  return;
 }
 if(phase==='holding'){
  if(s.engine!=='running')return interrupt(s,'Motores indisponíveis durante espera em voo.');
  // Circular visual holding pattern is an approximation, not an instrument holding procedure.
  auto.holdingElapsed+=dt;const center=auto.route.at(-1)!;
  const circle=destination(center,auto.holdingElapsed*.025,Math.min(2500,auto.holdingElapsed*60));
  const before=worldToGeo(s);s.heading=bearing(before,circle);setGeo(s,circle);s.y=auto.holdingFor==='approach'?1200:650;
  s.speed=Math.min(a.cruise*.514444,a.max*.514444);s.airborne=true;
  if(s.approachClearance && s.landingClearance){
   s.y=1200;
   setPhase(s,'approach');
  }
  return;
 }
 if(!progressing)return;
 if(s.engine!=='running'||s.fuel<=0){if(phase==='taxi_out'||phase==='lineup') {s.speed=0;s.throttle=0;return;}return interrupt(s,'Sem propulsão: operação autônoma interrompida.');}
 const t=stageProgress(s,movementDt,phase);
 const before=worldToGeo(s),oldY=s.y;
 const runwayFrom=fromAirport.runway,runwayTo=toAirport.runway;
 const cruiseSpeed=Math.min(a.cruise*.514444,a.max*.514444);
 if(phase==='taxi_out'){
  if(!s.taxiClearance){auto.phaseElapsed-=movementDt;auto.operationElapsed-=movementDt;auto.progress=clamp(auto.operationElapsed/Math.max(1,auto.targetMinutes*60-auto.pushbackBudget));s.speed=0;s.throttle=0;return;}
  const start=auto.taxiStart;
  const holding=runwayPosition(auto.from,-55,runwayFrom.length/2-160);
  moveLocal(s,{x:start.x+(holding.x-start.x)*smooth(t),z:start.z+(holding.z-start.z)*smooth(t)},dt);
  s.throttle=.15;s.gear=true;s.flaps=1;
  if(t>=1){s.speed=0;setPhase(s,'hold_short');}
 }else if(phase==='lineup'){
  const start=runwayPosition(auto.from,-55,runwayFrom.length/2-160);
  const end=runwayPosition(auto.from,0,runwayFrom.length/2-160);
  moveLocal(s,{x:start.x+(end.x-start.x)*smooth(t),z:start.z+(end.z-start.z)*smooth(t)},dt);
  s.heading=-runwayFrom.rotation;s.throttle=.16;
  if(t>=1){s.speed=0;s.throttle=0;
   if(s.clearance)setPhase(s,'takeoff');else setPhase(s,'hold_short');
  }
 }else if(phase==='takeoff'){
  if(!s.clearance){auto.phaseElapsed-=movementDt;auto.operationElapsed-=movementDt;auto.progress=clamp(auto.operationElapsed/Math.max(1,auto.targetMinutes*60-auto.pushbackBudget));s.speed=0;s.throttle=0;return;}
  s.departureChecked=true;s.throttle=1;s.flaps=1;
  const startL=runwayFrom.length/2-160,endL=-runwayFrom.length/2+160;
  const local=runwayPosition(auto.from,0,startL+(endL-startL)*t*t);
  const previous=s.y;s.y=t>.7?smooth((t-.7)/.3)*Math.max(35,a.stall*.514444):0;
  moveLocal(s,local,dt);s.heading=-runwayFrom.rotation;s.speed=Math.min(a.max*.514444,Math.max(a.stall*.514444*1.25,t*cruiseSpeed*.7));
  s.vertical=(s.y-previous)/dt;s.airborne=s.y>1;
  if(t>=1){s.gear=false;setPhase(s,'climb');}
 }else if(phase==='climb'||phase==='cruise'||phase==='descent'){
  const bands:{[key:string]:[number,number]}={climb:[0,.18],cruise:[.18,.80],descent:[.80,1]};
  const [begin,end]=bands[phase];const fraction=begin+(end-begin)*t;
  segmentMove(s,fraction,t,dt);
  const maxAltitude=Math.min(11000,Math.max(950,auto.routeLength*.08));
  s.y=phase==='climb'?35+(maxAltitude-35)*smooth(t):phase==='cruise'?maxAltitude:maxAltitude-(maxAltitude-1200)*smooth(t);
  s.vertical=(s.y-oldY)/dt;s.speed=phase==='climb'?Math.min(cruiseSpeed,a.stall*.514444*1.5+cruiseSpeed*.3*t):phase==='descent'?cruiseSpeed*(1-.35*t):cruiseSpeed;
  s.pitch=phase==='climb'?.07:phase==='descent'?-.035:0;s.bank=0;s.throttle=phase==='climb'?.9:phase==='descent'?.4:.73;
  s.gear=false;s.flaps=0;s.airborne=true;
  if(t>=1){if(phase==='climb')setPhase(s,'cruise');else if(phase==='cruise')setPhase(s,'descent');else if(!s.approachClearance||!s.landingClearance){auto.holdingFor=!s.approachClearance?'approach':'landing';setPhase(s,'holding');}else setPhase(s,'approach');}
 }else if(phase==='approach'){
  const p0=auto.approachStart;
  const p1=worldToGeo(runwayPosition(auto.to,0,runwayTo.length/2-40));
  const next=greatCirclePoint(p0,p1,t);
  const beforeGeo=worldToGeo(s);if(surfaceDistance(beforeGeo,next)>.001){s.heading=bearing(beforeGeo,next);setGeo(s,next);s.distance+=surfaceDistance(beforeGeo,next);}
  s.y=1200*(1-smooth(t))+8*smooth(t);s.vertical=(s.y-oldY)/dt;
  s.speed=Math.max(a.stall*.514444*1.25,cruiseSpeed*(1-.7*t));
  s.pitch=-.03;s.throttle=.28;s.flaps=2;s.gear=true;
  if(t>=1){if(!s.landingClearance)interrupt(s,'Autorização de pouso revogada durante a aproximação.');else setPhase(s,'landing');}
 }else if(phase==='landing'){
  const point=runwayPosition(auto.to,0,(runwayTo.length/2-40)-(runwayTo.length*.65)*t);
  moveLocal(s,point,dt);s.heading=-runwayTo.rotation;
  s.y=8*(1-smooth(Math.min(1,t*4)));s.vertical=(s.y-oldY)/dt;
  s.speed=Math.max(0,a.stall*.514444*1.3*(1-t));s.throttle=0;s.gear=true;s.flaps=2;
  if(t>=1){s.y=0;s.speed=0;s.vertical=0;s.landed=true;s.airborne=false;s.airportId=auto.to;s.ground=initialGround(auto.to);s.taxiClearance=false;setPhase(s,'taxi_in');}
 }else if(phase==='taxi_in'){
  if(!s.taxiClearance){auto.phaseElapsed-=movementDt;auto.operationElapsed-=movementDt;auto.progress=clamp(auto.operationElapsed/Math.max(1,auto.targetMinutes*60-auto.pushbackBudget));s.speed=0;s.throttle=0;return;}
  const start=runwayPosition(auto.to,0,(runwayTo.length/2-40)-runwayTo.length*.65);
  const halfway=runwayPosition(auto.to,-110,runwayTo.length/2-160);
  const gate=toAirport.gate;
  const q=t<.5?{x:start.x+(halfway.x-start.x)*smooth(t*2),z:start.z+(halfway.z-start.z)*smooth(t*2)}:{x:halfway.x+(gate.x-halfway.x)*smooth((t-.5)*2),z:halfway.z+(gate.z-halfway.z)*smooth((t-.5)*2)};
  moveLocal(s,q,dt);s.throttle=.15;s.flaps=0;
  if(t>=1){s.x=gate.x;s.z=gate.z;s.heading=toAirport.gateHeading;s.throttle=0;s.speed=0;s.gear=true;auto.progress=1;setPhase(s,'completed');s.systemMessage='Voo concluído: aeronave estacionada. Desligue os motores.';}
 }
 const traveled=surfaceDistance(before,worldToGeo(s));fuelBurn(s,a,traveled);
 if(s.y<0)interrupt(s,'Altitude inválida.');
 // Do not apply legacy broad-rectangle collisions to pre-scripted chart paths. No surveyed
 // taxiway geometry exists yet; these paths are illustrative, not guaranteed obstacle-free.

}
