import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aircraft, validateAircraft } from './aircraft';
import { initialState, step, issue, acceptReadback, configureAutonomous } from './engine';
import { parseProfile, missionProgress } from './profile';
import { commandAircraft } from './commands';
import { newRadio, requestRadio, transmitReadback } from './atc';
const a = aircraft.find(a => a.id === 'c152')!;

test('22 modelos com configuração básica validada', () => {
 assert.equal(aircraft.length,22);assert.equal(new Set(aircraft.map(a=>a.id)).size,22);
 aircraft.forEach(validateAircraft);assert.throws(()=>validateAircraft({...a,mass:-10}));
});
test('o motor não movimenta a aeronave enquanto não há plano e autorizações', () => {
 const s=initialState(a);for(let i=0;i<600;i++)step(s,a,1/60);
 assert.equal(s.x,-350);assert.equal(s.speed,0);
 assert.match(commandAircraft(s,a,{type:'engine'}),/autorização/);
 assert.equal(s.engine,'off');
});
test('acionamento exige GND, cotejamento e ausência de serviço de solo', () => {
 const s=initialState(a);
 const startup=issue('startup',s,'GND')!;assert.ok(startup);
 assert.equal(acceptReadback(startup,'autorizado',s),false);
 assert.equal(s.startupClearance,false);
 assert.equal(acceptReadback(startup,startup.readback,s),true);
 assert.equal(s.startupClearance,true);
 commandAircraft(s,a,{type:'engine'});assert.equal(s.engine,'starting');
 for(let i=0;i<40;i++)step(s,a,.1);
 assert.equal(s.engine,'running');
 commandAircraft(s,a,{type:'engine'});assert.equal(s.engine,'off');
});
test('rádio concede liberação apenas após cotejamento correto',()=>{
 const s=initialState(a,'runway');const radio=newRadio();radio.sector='TWR';
 requestRadio(radio,'takeoff',s);assert.ok(radio.pending);
 assert.equal(transmitReadback(radio,'autorizado',s),false);
 assert.equal(s.clearance,false);
 assert.equal(transmitReadback(radio,radio.pending!.readback,s),true);
 assert.equal(s.clearance,true);
});
test('aeronaves somente visuais não oferecem dinâmica autônoma',()=>{
 const balloon=aircraft.find(a=>a.id==='balloon')!;const s=initialState(balloon);
 assert.match(configureAutonomous(s,balloon,'SBGR','SBSP','realista')!,/indisponível/);
 step(s,balloon,.1);assert.equal(s.speed,0);assert.equal(s.y,0);
});
test('perfil legado e missões existentes não são apagados',()=>{
 assert.equal(parseProfile('{broken').xp,0);
 assert.equal(parseProfile(JSON.stringify({version:0,name:'Teste',xp:12})).version,1);
 const s=initialState(a),m={id:'taxi' as const,active:true,originDistance:0,done:false,failed:false};
 s.taxiClearance=true;s.distance=301;s.speed=0;
 assert.equal(missionProgress(m,s).done,true);
});
