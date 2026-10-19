import type { Aircraft } from './aircraft';
import { aircraft } from './aircraft';
import type { FlightState } from './engine';
import { airports, congonhasStructures, runwayPoint, type AirportId, type Point2 } from './airports';

export const buildings = [{x:-470,z:0,w:65,d:540,h:24},{x:-650,z:-500,w:170,d:150,h:32},{x:-650,z:470,w:150,d:110,h:30},{x:-535,z:340,w:24,d:24,h:65}];
export const parkedAircraft = [0,2,4,6,8].map((gate, i) => ({ x: -356, z: -300 + gate * 75, heading: -Math.PI / 2, aircraft: aircraft[[4,5,10,8,6][i]] }));
export type VehicleKind = 'tug'|'gpu'|'fuel'|'water'|'lavatory'|'stairs'|'belt'|'baggage'|'operations'|'maintenance'|'fire'|'ambulance'|'bus';
export const vehicleLabels: Record<VehicleKind,string> = {tug:'Trator de pushback',gpu:'GPU',fuel:'Abastecimento',water:'Água potável',lavatory:'Lavatório',stairs:'Escada móvel',belt:'Esteira de bagagens',baggage:'Trator com carretas',operations:'Operações',maintenance:'Manutenção',fire:'Bombeiros',ambulance:'Ambulância',bus:'Ônibus'};
export type Point = Point2;
export type Vehicle = Point & { id:string; kind:VehicleKind; heading:number; state:'idle'|'moving'|'working'|'returning'|'waiting'; target:number; route:Point[]; home:Point };
export type PushPhase = 'idle'|'approaching'|'connected'|'pushing'|'returning'|'completed'|'waiting';
export type GroundState = { vehicles:Vehicle[]; pushback:{ phase:PushPhase; elapsed:number; route:Point[]; target:number; moved:number }; service:null|{ kind:VehicleKind; phase:'approaching'|'working'|'returning'; elapsed:number }; message:string; lastCompleted:string };
const lane = [{x:-544,z:-730},{x:-544,z:730},{x:-556,z:730},{x:-556,z:-730}];
const shift = (id:AirportId,p:Point):Point => id!=='SBGR' ? runwayPoint(airports[id].runway,p.x,p.z) : ({x:p.x,z:p.z});
const local = (s:FlightState,p:Point):Point => shift(s.airportId,p);
const allBuildings = [...buildings,...congonhasStructures];
const allParkedAircraft = [...parkedAircraft,...parkedAircraft.slice(0,3).map(v=>({...v,...shift('SBSP',v),heading:v.heading+airports.SBSP.runway.rotation}))];
export function initialGround(airportId:AirportId='SBGR'): GroundState {
  const kinds = Object.keys(vehicleLabels) as VehicleKind[];
  const vehicles:Vehicle[] = kinds.map((kind,i)=>{
    const moving = ['operations','maintenance','fire','bus','ambulance'].includes(kind);
    const home = moving ? {x:-544,z:-680+i*95} : {x:-590,z:-270+i*24};
    const placed=shift(airportId,home);return { id:`fleet-${kind}`,kind,...placed,home:placed,heading:Math.PI,state:moving?'moving':'idle',target:1,route:moving?lane.map(p=>shift(airportId,p)):[] };
  });
  const tug=shift(airportId,{x:-410,z:225});vehicles.push({ id:'pushback',kind:'tug',...tug,home:tug,heading:Math.PI/2,state:'idle',target:0,route:[] });
  const service=shift(airportId,{x:-237,z:225});vehicles.push({ id:'service',kind:'gpu',...service,home:service,heading:0,state:'idle',target:0,route:[] });
  return {vehicles,pushback:{phase:'idle',elapsed:0,route:[],target:0,moved:0},service:null,message:airportId==='SBSP'?'Posição de teste CGH disponível.':'Posição G8 disponível para os testes.',lastCompleted:''};
}
const metricScale=(p:Point)=>Object.values(airports).find(ap=>ap.schematic&&Math.hypot(p.x-ap.world.x,p.z-ap.world.z)<10000)?.runway.chartScale??1;
export function inFootprint(p:Point, center:Point & {heading:number}, a:Aircraft, margin=0) {
  const dx=(p.x-center.x)/metricScale(center),dz=p.z-center.z;
  const lateral=dx*Math.cos(center.heading)+dz*Math.sin(center.heading);
  const longitudinal=dx*Math.sin(center.heading)-dz*Math.cos(center.heading);
  return Math.abs(lateral)<a.span/2+margin && Math.abs(longitudinal)<a.length/2+margin;
}
function clearPoint(p:Point,radius:number) {
  return !allBuildings.some(b=>Math.abs(p.x-b.x)<b.w/2+radius&&Math.abs(p.z-b.z)<b.d/2+radius) && !allParkedAircraft.some(v=>inFootprint(p,v,v.aircraft,radius));
}
export function atServiceStand(s:FlightState) {const gate=airports[s.airportId].gate;return s.y===0 && Math.abs(s.x-gate.x)<4 && Math.abs(s.z-gate.z)<4 && Math.abs(s.heading-airports[s.airportId].gateHeading)<.1;}
export function groundReason(s:FlightState,a:Aircraft,push=false) {
  if(a.status==='Modelo visual') return 'Disponível apenas para aeronaves com física básica.';
  if(s.crashed) return 'Reposicione a aeronave após a ocorrência.';
  if(!atServiceStand(s)) return `Reposicione no pátio ${s.airportId==='SBSP'?'de teste CGH':'G8'} para utilizar este serviço.`;
  if(s.speed>.1 || s.throttle>.01 || s.engine==='running'||s.engine==='starting') return 'Pare, desligue os motores e reduza a potência a zero.';
  if(s.ground.service || !['idle','completed'].includes(s.ground.pushback.phase)) return 'Outro equipamento está em operação. Aguarde a retirada.';
  if(push && !s.pushbackClearance) return 'Solicite pushback no canal GND e coteje a autorização.';
  return '';
}
function follow(v:Vehicle,route:Point[],state:Vehicle['state']='moving') {v.route=route;v.target=0;v.state=state;}
export function requestPushback(s:FlightState,a:Aircraft) {
  const reason=groundReason(s,a,true); if(reason) return s.ground.message=reason;
  const nose={x:s.x-(a.length/2+5)*metricScale(s),z:s.z};
  const tug=s.ground.vehicles.find(v=>v.id==='pushback')!;
  follow(tug,[nose]);
  s.ground.pushback={phase:'approaching',elapsed:0,route:[{x:-265,z:225},{x:-250,z:240},{x:-245,z:265},{x:-245,z:305}].map(p=>local(s,p)),target:0,moved:0};
  return s.ground.message='Trator a caminho. Motores e potência bloqueados até sua retirada.';
}
export function requestService(s:FlightState,a:Aircraft,kind:VehicleKind) {
  const reason=groundReason(s,a);if(reason)return s.ground.message=reason;
  if(!['gpu','fuel','water','lavatory','stairs','belt','baggage'].includes(kind))return s.ground.message='Equipamento disponível apenas na frota ambiente.';
  const v=s.ground.vehicles.find(v=>v.id==='service')!;v.kind=kind;
  follow(v,[{x:s.x+(a.length/2+9)*metricScale(s),z:s.z}]);
  s.ground.service={kind,phase:'approaching',elapsed:0};
  return s.ground.message=`${vehicleLabels[kind]} solicitado. Aguarde a aproximação.`;
}
export function releaseService(s:FlightState) {
  const job=s.ground.service;if(!job || job.phase==='returning')return;
  const v=s.ground.vehicles.find(v=>v.id==='service')!;
  follow(v,[v.home],'returning');job.phase='returning';s.ground.message='Equipamento desconectado. Aguarde a retirada.';
}
function moveVehicle(v:Vehicle,s:FlightState,a:Aircraft,dt:number) {
  const destination=v.route[v.target];if(!destination)return true;
  const dx=destination.x-v.x,dz=destination.z-v.z,scale=metricScale(v),d=Math.hypot(dx/scale,dz);
  if(d<.1){v.target++;return v.target>=v.route.length;}
  const amount=Math.min(d,(v.id.startsWith('fleet')?3:2.5)*dt);
  const next={x:v.x+dx/d*amount,z:v.z+dz/d*amount};
  const margin=v.kind==='bus'||v.kind==='fire'?4:2;
  const blocked=!clearPoint(next,margin)|| (s.y<8&&inFootprint(next,s,a,margin)) || s.ground.vehicles.some(other=>other!==v&&Math.hypot((next.x-other.x)/scale,next.z-other.z)<(other.kind==='baggage'?12:8));
  if(blocked){v.state='waiting';return false;}
  v.x=next.x;v.z=next.z;v.heading=Math.atan2(dx/scale,-dz);v.state=v.id==='service'&&s.ground.service?.phase==='returning'?'returning':'moving';return false;
}
export function stepGround(s:FlightState,a:Aircraft,dt:number): boolean {
  const g=s.ground;
  for(const v of g.vehicles.filter(v=>v.id.startsWith('fleet')&&v.route.length))if(moveVehicle(v,s,a,dt)){v.target=0;}
  const p=g.pushback,tug=g.vehicles.find(v=>v.id==='pushback')!;
  const active=!['idle','completed'].includes(p.phase);
  if(p.phase==='approaching'&&moveVehicle(tug,s,a,dt)){p.phase='connected';p.elapsed=0;tug.state='working';g.message='Trator conectado. Iniciando recuo a 1,5 m/s.';}
  else if(p.phase==='connected'){p.elapsed+=dt;if(p.elapsed>=1)p.phase='pushing';}
  else if(p.phase==='pushing'||p.phase==='waiting'){
    const target=p.route[p.target];
    if(!target){p.phase='returning';s.speed=0;s.pushbackClearance=false;follow(tug,[{x:tug.x-12,z:tug.z},local(s,{x:-310,z:225}),local(s,{x:-410,z:225})],'returning');g.message='Recuo concluído. Trator desconectando e retornando.';}
    else {
      const dx=target.x-s.x,dz=target.z-s.z,scale=metricScale(s),d=Math.hypot(dx/scale,dz),amount=Math.min(d,1.5*dt);
      if(d<.1)p.target++;
      else {
        const next={x:s.x+dx/d*amount,z:s.z+dz/d*amount};
        const heading=Math.atan2(-dx/scale,dz);
        const blocked=allBuildings.some(b=>Math.abs(next.x-b.x)<b.w/2+a.span/2&&Math.abs(next.z-b.z)<b.d/2+a.length/2)||allParkedAircraft.some(v=>inFootprint(v,{...next,heading},a,Math.min(v.aircraft.span,v.aircraft.length)/2))||g.vehicles.some(v=>v!==tug&&inFootprint(v,{...next,heading},a,3));
        if(blocked){p.phase='waiting';g.message='Pushback aguardando: trajetória ocupada.';}
        else {p.phase='pushing';s.x=next.x;s.z=next.z;s.heading+=Math.atan2(Math.sin(heading-s.heading),Math.cos(heading-s.heading))*Math.min(1,dt*1.5);p.moved+=amount;s.speed=0;tug.x=s.x+Math.sin(s.heading)*(a.length/2+5)*scale;tug.z=s.z-Math.cos(s.heading)*(a.length/2+5);tug.heading=s.heading;tug.state='working';}
      }
    }
  } else if(p.phase==='returning'&&moveVehicle(tug,s,a,dt)){p.phase='completed';tug.state='idle';g.message=`Pushback concluído: ${Math.round(p.moved)} m. Solicite táxi no GND.`;g.lastCompleted='Pushback';}
  const job=g.service,v=g.vehicles.find(v=>v.id==='service')!;
  if(job?.phase==='approaching'&&moveVehicle(v,s,a,dt)){job.phase='working';v.state='working';g.message=job.kind==='gpu'?'GPU conectada visualmente; sistema elétrico não simulado.':'Equipamento posicionado. Serviço em andamento.';}
  else if(job?.phase==='working'){
    job.elapsed+=dt;
    if(job.kind==='fuel')s.fuel=Math.min(a.fuel,s.fuel+a.fuel*.004*dt);
    if(job.kind!=='gpu'&&job.elapsed>=6)releaseService(s);
  } else if(job?.phase==='returning'&&moveVehicle(v,s,a,dt)){g.lastCompleted=vehicleLabels[job.kind];g.message=`${g.lastCompleted}: serviço concluído e equipamento retirado.`;g.service=null;v.state='idle';}
  return active || g.service!==null;
}
export function groundCollision(s:FlightState,a:Aircraft) {
  if(s.y>8)return false;
  if(allParkedAircraft.some(v=>inFootprint(s,v,v.aircraft,Math.min(a.length,a.span)*.35)))return true;
  return s.ground.vehicles.some(v=>inFootprint(v,s,a,1.5));
}
