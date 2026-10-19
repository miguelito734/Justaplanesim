import type { FlightState } from './engine';
import { atServiceStand } from './ground';
import { airportForPoint, isOnRunway } from './airports';
export type Sector='GND'|'TWR'|'APP'|'ACC';
export type ClearanceKind='departure'|'startup'|'pushback'|'taxi'|'lineup'|'takeoff'|'approach'|'landing'|'position'|'vacated';
export type Clearance={kind:ClearanceKind;sector:Sector;text:string;readback:string;accepted:boolean;status:'pending'|'rejected'|'accepted'|'cancelled'};
export type RadioMessage={id:number;from:string;text:string;status:'info'|'sent'|'pending'|'accepted'|'rejected'|'cancelled';time:string};
export type RadioState={sector:Sector;pending:Clearance|null;messages:RadioMessage[];sequence:number};
export const frequencies:Record<Sector,string>={GND:'121.700',TWR:'118.400',APP:'129.750',ACC:'125.450'};
export const actionLabels:Record<ClearanceKind,string>={departure:'Informações de partida',startup:'Solicitar acionamento',pushback:'Solicitar pushback',taxi:'Solicitar táxi',lineup:'Solicitar alinhamento',takeoff:'Solicitar decolagem',approach:'Solicitar aproximação',landing:'Solicitar pouso',position:'Reportar posição',vacated:'Informar pista livre'};
export function newRadio():RadioState{return {sector:'GND',pending:null,sequence:0,messages:[{id:0,from:'SISTEMA',text:'ATC automatizado local. Frequências e procedimentos simplificados; sem controlador online.',status:'info',time:'00:00'}]};}
function log(r:RadioState,from:string,text:string,status:RadioMessage['status']) {r.sequence++;r.messages=[...r.messages.slice(-39),{id:r.sequence,from,text,status,time:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}];}
export function onRunway(s:FlightState){return isOnRunway(s);}
const rules:Record<ClearanceKind,{sector:Sector;available:(s:FlightState)=>boolean;text:string;readback:string}>={
 departure:{sector:'GND',available:s=>s.y===0&&!s.departureClearance,text:'PT-JPS, saída local, pista 10L em uso, QNH 1013. Mantenha posição.',readback:'Pista 10L, QNH 1013, manter posição, PT-JPS'},
 startup:{sector:'GND',available:s=>s.y===0&&s.engine!=='running'&&s.engine!=='starting'&&!s.startupClearance,text:'PT-JPS, acionamento aprovado. Mantenha posição.',readback:'Acionamento aprovado, manter posição, PT-JPS'},
 pushback:{sector:'GND',available:s=>atServiceStand(s)&&s.speed<.1&&!s.pushbackClearance&&s.engine!=='running'&&s.engine!=='starting',text:'PT-JPS, pushback aprovado da posição G8. Mantenha motores desligados durante o reboque de teste.',readback:'Pushback aprovado, posição G8, motores desligados, PT-JPS'},
 taxi:{sector:'GND',available:s=>s.y===0&&!s.taxiClearance,text:'PT-JPS, táxi pela Alfa, mantenha antes da pista 10L.',readback:'Alfa, manter antes da pista 10L, PT-JPS'},
 lineup:{sector:'TWR',available:s=>s.y===0&&isOnRunway(s,undefined,60)&&!s.lineUpClearance,text:'PT-JPS, alinhe pista 10L e aguarde. Decolagem não autorizada.',readback:'Alinhar pista 10L e aguardar, PT-JPS'},
 takeoff:{sector:'TWR',available:s=>s.y===0&&onRunway(s)&&Math.abs(Math.sin(s.heading+airportForPoint(s).runway.rotation))<.15&&Math.cos(s.heading+airportForPoint(s).runway.rotation)>.98&&!s.clearance,text:'PT-JPS, pista 10L, autorizado decolagem.',readback:'Pista 10L, autorizado decolagem, PT-JPS'},
 approach:{sector:'APP',available:s=>s.y>0&&!s.approachClearance,text:'PT-JPS, prossiga aproximação visual para pista 10L. Reporte na final à Torre 118.400.',readback:'Aproximação visual pista 10L, Torre 118.400, PT-JPS'},
 landing:{sector:'TWR',available:s=>s.y>0&&!s.landingClearance,text:'PT-JPS, pista 10L, autorizado pouso.',readback:'Pista 10L, autorizado pouso, PT-JPS'},
 position:{sector:'APP',available:s=>s.y>0,text:'',readback:''},
 vacated:{sector:'TWR',available:s=>s.landed&&s.y===0&&!onRunway(s),text:'PT-JPS, pista livre recebida. Contate Solo 121.700 para táxi.',readback:''},
};
export function availableActions(s:FlightState,sector:Sector){if(s.crashed)return [];return (Object.keys(rules) as ClearanceKind[]).filter(kind=>(rules[kind].sector===sector||(kind==='position'&&sector==='ACC'))&&rules[kind].available(s));}
export function issue(kind:ClearanceKind,s:FlightState,sector:Sector):Clearance|null {
 if(!availableActions(s,sector).includes(kind))return null;
 const rule=rules[kind], airport=airportForPoint(s);return {kind,sector,text:rule.text.replaceAll('10L',airport.primaryRunwayLabel).replaceAll('G8',airport.id==='SBSP'?'de teste CGH':'G8'),readback:rule.readback.replaceAll('10L',airport.primaryRunwayLabel).replaceAll('G8',airport.id==='SBSP'?'de teste CGH':'G8'),accepted:false,status:'pending'};
}
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/pt[ -]*jps/g,'ptjps').replace(/[^a-z0-9]+/g,' ').trim();
export function acceptReadback(c:Clearance,text:string,s:FlightState) {
 if(c.accepted||c.status==='cancelled'||!c.readback||!availableActions(s,c.sector).includes(c.kind))return false;
 const tokens=normalize(text).split(' '),required=normalize(c.readback).split(' ').filter(v=>!['a','da','de','e','para'].includes(v));
 if(tokens.some(v=>['nao','negativo','cancelado','recusado'].includes(v))||!required.every(v=>tokens.includes(v))||tokens.some(v=>/^\d+[lr]$/.test(v)&&v!==airportForPoint(s).primaryRunwayLabel.toLowerCase())){c.status='rejected';return false;}
 c.accepted=true;c.status='accepted';
 switch(c.kind){case 'departure':s.departureClearance=true;break;case 'startup':s.startupClearance=true;break;case 'pushback':s.pushbackClearance=true;break;case 'taxi':s.taxiClearance=true;break;case 'lineup':s.lineUpClearance=true;break;case 'takeoff':s.clearance=true;break;case 'approach':s.approachClearance=true;break;case 'landing':s.landingClearance=true;break;}
 return true;
}
export function requestRadio(r:RadioState,kind:ClearanceKind,s:FlightState){
 if(r.pending&&!r.pending.accepted){log(r,'SISTEMA','Coteje ou cancele a solicitação pendente antes de transmitir outra.','rejected');return;}
 log(r,'PT-JPS',`${airportForPoint(s).shortName} ${r.sector}, PT-JPS, ${actionLabels[kind].toLowerCase()}.`,'sent');
 const c=issue(kind,s,r.sector);if(!c){log(r,r.sector,'Solicitação recusada: setor, posição ou fase incompatível.','rejected');return;}
 if(kind==='position'){log(r,r.sector,`PT-JPS, posição recebida: ${Math.round(s.y*3.28084)} pés AGL, ${Math.round(s.speed*1.94384)} nós. Reporte intenções à Aproximação para regresso. Dados locais, não nível de voo.`,'accepted');return;}
 if(kind==='vacated'){s.landingClearance=false;s.clearance=false;r.pending=null;log(r,r.sector,c.text,'accepted');return;}
 r.pending=c;log(r,r.sector,c.text,'pending');
}
export function transmitReadback(r:RadioState,text:string,s:FlightState){
 const c=r.pending;if(!c||c.accepted)return false;
 log(r,'PT-JPS',text||'(transmissão vazia)','sent');
 if(acceptReadback(c,text,s)){log(r,c.sector,'Cotejamento correto. Autorização registrada.','accepted');return true;}
 c.status='rejected';log(r,c.sector,`Correção: confira indicativo e dados da autorização. Esperado: ${c.readback}. Você pode corrigir ou cancelar.`,'rejected');return false;
}
export function cancelRadio(r:RadioState){if(r.pending&&!r.pending.accepted){r.pending.status='cancelled';log(r,r.pending.sector,'Solicitação cancelada. Nenhuma autorização concedida.','cancelled');}r.pending=null;}
export function tuneRadio(r:RadioState,sector:Sector){cancelRadio(r);r.sector=sector;log(r,'SISTEMA',`Canal ${sector}: ${frequencies[sector]} MHz. Autorizações já aceitas preservadas.`,'info');}
