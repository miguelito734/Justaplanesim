import { test } from 'node:test';
import assert from 'node:assert/strict';
import { airports, airportForPoint, distanceMeters, geoToWorld, getSpawn, isOnRunway, runwayCoordinates } from './airports';
import { aircraft } from './aircraft';
import { initialState, step } from './engine';
import { groundReason, atServiceStand, requestService } from './ground';
import { issue, acceptReadback } from './atc';
const a=aircraft[0];
const neutral={pitch:0,turn:0,brake:false};
test('GRU e CGH têm identificadores e posições geográficas distintas',()=>{
 assert.equal(airports.SBGR.iata,'GRU');assert.equal(airports.SBSP.iata,'CGH');
 assert.equal(distanceMeters(geoToWorld(airports.SBGR.latitude,airports.SBGR.longitude),{x:0,z:0}),0);
 assert.ok(airports.SBSP.world.x < -18000 && airports.SBSP.world.z > 20000);
 const d=distanceMeters(airports.SBGR.world,airports.SBSP.world);
 assert.ok(d>=28000&&d<=29000,`Distância: ${d.toFixed(0)} m`);
});
test('Pistas de CGH respeitam escala e orientação distinta de GRU',()=>{
 assert.equal(airports.SBSP.runways.length,2);
 assert.deepEqual(airports.SBSP.runways.map(r=>r.length),[1940,1435]);
 assert.ok(Math.abs(airports.SBSP.runway.rotation)>.45);
 for(const runway of airports.SBSP.runways) assert.ok(isOnRunway(runway.center));
});
test('Seleção de aeroportos conserva gate, cabeceira e aproximação no mesmo mundo',()=>{
 for(const id of ['SBGR','SBSP'] as const){
  const gate=initialState(a,'gate',id),runway=initialState(a,'runway',id),approach=initialState(a,'approach',id);
  assert.equal(gate.airportId,id);assert.equal(runway.airportId,id);assert.equal(approach.airportId,id);
  assert.ok(atServiceStand(gate));assert.ok(isOnRunway(runway));assert.equal(approach.y,150);
  assert.equal(approach.engine,'running');assert.equal(airportForPoint(gate).id,id);
  const runwayLocal=runwayCoordinates(airports[id].runway,runway);
  assert.ok(Math.abs(runwayLocal.x)<1);
 }
 assert.equal(initialState(a).x,-350);
 assert.equal(initialState(a,'runway').z,760);
});
test('CGH preserva serviço de solo e solicitação de abastecimento',()=>{
 const s=initialState(a,'gate','SBSP');assert.equal(groundReason(s,a),'');
 const response=requestService(s,a,'fuel');assert.match(response,/solicitado/);
 assert.equal(s.ground.service?.kind,'fuel');
 assert.ok(s.ground.vehicles.every(v=>v.x < -15000),'Frota também está no aeroporto selecionado');
});
test('ATC local oferece autorização da pista 35L em CGH',()=>{
 const s=initialState(a,'runway','SBSP');
 const c=issue('takeoff',s,'TWR');assert.ok(c);if(!c)throw new Error('ATC não autorizou decolagem em CGH');assert.match(c.text,/35L/);
 assert.ok(acceptReadback(c,c.readback,s));assert.equal(s.clearance,true);
});
test('Voo entre GRU e CGH mantém coordenadas contínuas, sem troca de mapa',()=>{
 const s=initialState(a,'approach','SBGR');
 // Condições de cruzeiro simplificadas para testar os limites espaciais,
 // sem controlar o avião automaticamente nem alterar o motor físico.
 s.x=0;s.z=0;s.y=1000;s.speed=100;s.heading=Math.atan2(airports.SBSP.world.x,-airports.SBSP.world.z);
 s.engine='running';s.throttle=.7;s.airborne=true;
 const start=distanceMeters(s,airports.SBSP.world);
 let greatestJump=0;
 for(let i=0;i<19000;i++){
  const x=s.x,z=s.z;step(s,a,neutral,1/60);greatestJump=Math.max(greatestJump,Math.hypot(s.x-x,s.z-z));
  if(s.crashed)break;
 }
 assert.equal(s.crashed,false,s.warning);
 assert.ok(distanceMeters(s,airports.SBSP.world)<start/2);
 assert.ok(greatestJump<5,`Salto de ${greatestJump} metros`);
 assert.equal(airportForPoint(s).id,'SBSP');
});
test('Abastecimento real conclui sem regressão em GRU e CGH',()=>{
 for(const id of ['SBGR','SBSP'] as const){
  const s=initialState(a,'gate',id),fuel=s.fuel;
  requestService(s,a,'fuel');
  for(let i=0;i<90*60;i++)step(s,a,neutral,1/60);
  assert.ok(s.fuel>fuel,`${id}: combustível não foi reposto`);
  assert.equal(s.ground.service,null,`${id}: serviço não foi concluído`);
  assert.equal(s.crashed,false,`${id}: colisão durante abastecimento`);
 }
});
