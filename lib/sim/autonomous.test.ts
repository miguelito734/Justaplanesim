import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aircraft } from './aircraft';
import { initialState, configureAutonomous, step, issue, acceptReadback } from './engine';
import { requestPushback } from './ground';
import { airports } from './airports';
import { aircraftCompatibility, realFlightMinutes, modeFlightMinutes } from '../ui/flight-plan';
const get=(id:string)=>aircraft.find(a=>a.id===id)!;
const grant=(s:ReturnType<typeof initialState>,kind:Parameters<typeof issue>[0],sector:Parameters<typeof issue>[2])=>{
 const clearance=issue(kind,s,sector);if(clearance)assert.equal(acceptReadback(clearance,clearance.readback,s),true,kind);
};
function simulate(from:'SBGR'|'KJFK',to:'SBSP'|'SBGR',id:string,mode:'realista'|'normal'|'rapido',scope:'free'|'career'='free') {
 const a=get(id),s=initialState(a,'gate',from);
 assert.equal(configureAutonomous(s,a,from,to,mode,scope),null);
 let hasTakenOff=false,hasCruised=false,hasLanded=false,hasTaxied=false,maxGeoStep=0;
 for(let i=0;i<200000;i++) {
  const phase=s.auto!.phase;
  if(phase==='parked'){
   grant(s,'startup','GND');grant(s,'pushback','GND');
   if(s.ground.pushback.phase==='idle')requestPushback(s,a);
  }
  if(phase==='taxi_out')grant(s,'taxi','GND');
  if(phase==='taxi_out'&&s.engine==='off') {s.startupClearance=true;s.engine='starting';}
  if(phase==='hold_short'||phase==='lineup') {grant(s,'lineup','TWR');grant(s,'takeoff','TWR');}
  if(s.y>1) {grant(s,'approach','APP');grant(s,'landing','TWR');}
  if(phase==='taxi_in') grant(s,'taxi','GND');
  hasTakenOff ||= phase==='takeoff';hasCruised ||= phase==='cruise';hasLanded ||= phase==='landing';hasTaxied ||= phase==='taxi_in';
  const before={x:s.x,z:s.z};step(s,a,.1);
  maxGeoStep=Math.max(maxGeoStep,Math.hypot(s.x-before.x,s.z-before.z));
  assert.equal(s.crashed,false,s.warning);
  if(s.auto?.phase==='completed') {
   assert.ok(hasTakenOff&&hasCruised&&hasLanded&&hasTaxied,'Faltou uma fase operacional');
   assert.equal(s.landed,true);assert.equal(s.speed,0);assert.equal(s.y,0);
   assert.ok(Math.hypot(s.x-airports[to].gate.x,s.z-airports[to].gate.z)<1);
   assert.ok(s.distance>10000);
   assert.ok(Math.abs((i+1)*.1 - s.auto.targetMinutes*60)<35,'Duração fora da tolerância do plano sem esperas extras');
   return {s,seconds:(i+1)*.1,maxGeoStep};
  }
 }
 assert.fail(`Voo não completou: ${s.auto?.phase}`);
}

test('voo automático completo GRU→CGH com operações e chegada ao portão (Rápido 5m)',()=>{
 const {s,seconds,maxGeoStep}=simulate('SBGR','SBSP','c152','rapido');
 assert.equal(s.auto!.targetMinutes,5);assert.ok(seconds>=300&&seconds<=320);
 assert.ok(maxGeoStep<50);
});
test('E195 em voo realista conclui o trajeto com taxi-in',()=>{
 const {s}=simulate('SBGR','SBSP','e195','realista');
 assert.equal(s.auto!.targetMinutes,s.auto!.realMinutes);
});
test('voo longo JFK→GRU chega sem teletransporte direto (15 minutos em Rápido)',()=>{
 const {s}=simulate('KJFK','SBGR','b777','rapido');
 assert.equal(s.auto!.targetMinutes,15);assert.ok(s.distance>7_000_000);
});
test('sem autorização de táxi ou motores, aeronave não sai do estacionamento',()=>{
 const a=get('c152'),s=initialState(a);configureAutonomous(s,a,'SBGR','SBSP','rapido');
 for(let i=0;i<1000;i++)step(s,a,.1);
 assert.equal(s.auto!.phase,'parked');assert.equal(s.x,airports.SBGR.gate.x);
});
test('autorização de decolagem negada bloqueia o movimento na cabeceira',()=>{
 const a=get('c152'),s=initialState(a);configureAutonomous(s,a,'SBGR','SBSP','rapido');
 s.auto!.phase='hold_short';s.engine='running';s.lineUpClearance=true;
 s.x=airports.SBGR.runway.center.x;s.z=airports.SBGR.runway.length/2-160;
 for(let i=0;i<100;i++)step(s,a,.1);
 assert.equal(s.auto!.phase,'hold_short');assert.equal(s.y,0);assert.equal(s.speed,0);
});
test('Carreira: mesmo quando configurada com Rápido, o tempo permanece Realista',()=>{
 const a=get('e195'),s=initialState(a);configureAutonomous(s,a,'SBGR','SBSP','rapido','career');
 assert.equal(s.auto!.targetMinutes,s.auto!.realMinutes);assert.equal(s.auto!.scope,'career');
});
test('compatibilidade bloqueia C152 JFK–GRU e permite B777',()=>{
 assert.equal(aircraftCompatibility(get('c152'),'KJFK','SBGR').available,false);
 assert.equal(aircraftCompatibility(get('b777'),'KJFK','SBGR').available,true);
 assert.equal(aircraftCompatibility(get('balloon'),'SBGR','SBSP').available,false);
});
test('duração do modo rápido respeita limiar de 30 minutos exatos',()=>{
 assert.equal(modeFlightMinutes(30,'rapido'),5);
 assert.equal(modeFlightMinutes(30.01,'rapido'),15);
 assert.equal(modeFlightMinutes(100,'normal'),50);
 assert.equal(modeFlightMinutes(100,'rapido','career'),100);
 assert.equal(realFlightMinutes('SBGR','SBGR',get('c152')),null);
});

test('Normal executa rota curta em metade da duração Realista',()=>{
 const {s}=simulate('SBGR','SBSP','c152','normal');
 assert.equal(s.auto!.targetMinutes,s.auto!.realMinutes/2);
});
test('missão da Carreira ignora Rápido inclusive durante o voo completo',()=>{
 const {s}=simulate('SBGR','SBSP','e195','rapido','career');
 assert.equal(s.auto!.targetMinutes,s.auto!.realMinutes);
});
test('sem aproximação e pouso autorizados, a aeronave mantém espera em voo',()=>{
 const a=get('c152'),s=initialState(a);configureAutonomous(s,a,'SBGR','SBSP','rapido');
 s.engine='running';s.auto!.phase='descent';s.auto!.phaseDuration=.1;s.auto!.phaseElapsed=0;s.y=1400;
 step(s,a,.1);assert.equal(s.auto!.phase,'holding');assert.equal(s.landed,false);
 for(let i=0;i<10;i++)step(s,a,.1);assert.equal(s.auto!.phase,'holding');assert.equal(s.landed,false);
});
