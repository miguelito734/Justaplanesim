'use client';
import { useEffect, useRef, useState } from 'react';
import { Radio, X, Send, Check, Copy } from 'lucide-react';
import type { FlightState } from '@/lib/sim/engine';
import { newRadio, frequencies, availableActions, actionLabels, requestRadio, transmitReadback, cancelRadio, tuneRadio, onRunway, type RadioState, type Sector } from '@/lib/sim/atc';
export function RadioPanel({sim,s,mobileOpen,close,refresh}:{sim:React.RefObject<FlightState>;s:FlightState;mobileOpen:boolean;close:()=>void;refresh:()=>void}){
 const [radio,setRadio]=useState(()=>({...newRadio(),sector:(s.y>0?'APP':onRunway(s)?'TWR':'GND') as Sector}));
 const [text,setText]=useState('');const history=useRef<HTMLDivElement>(null);
 const mutate=(fn:(r:RadioState)=>void)=>{const next=structuredClone(radio);fn(next);setRadio(next);refresh();};
 useEffect(()=>{history.current?.scrollTo({top:history.current.scrollHeight,behavior:'smooth'});},[radio.sequence]);
 const pending=radio.pending&&!radio.pending.accepted?radio.pending:null;
 const transmit=()=>mutate(r=>{if(transmitReadback(r,text,sim.current))setText('');});
 return <section className={`radio-panel glass-panel radio-v2 ${mobileOpen?'mobile-open':''}`} aria-label="Comunicações ATC">
 <header><div><Radio size={16}/><strong>Rádio operacional</strong><span className="live-dot"/></div><button aria-label="Ocultar comunicações" onClick={close}><X size={16}/></button></header>
 <div className="radio-channels">{(['GND','TWR','APP','ACC'] as Sector[]).map(sector=><button key={sector} className={radio.sector===sector?'active':''} onClick={()=>{mutate(r=>tuneRadio(r,sector));setText('');}}>{sector}</button>)}<span>{frequencies[radio.sector]}<small> MHz</small></span></div>
 <div className="radio-local">ATC SIMULADO LOCALMENTE · PT-JPS</div>
 <div ref={history} className="radio-messages" role="log" aria-live="polite" aria-label="Histórico de rádio">{radio.messages.map(m=><div key={m.id} className={`radio-message message-${m.status}`}><span className={m.from==='PT-JPS'?'pilot-tag':''}>{m.from}</span><p>{m.text}<small className="message-status">{{info:'Informação',sent:'Transmitida',pending:'Aguardando cotejamento',accepted:'Aceita',rejected:'Recusada / correção',cancelled:'Cancelada'}[m.status]}</small></p><time>{m.time}</time></div>)}</div>
 {pending?<div className="readback"><label htmlFor="readback">{pending.status==='rejected'?'Corrija e tente novamente':'Cotejamento pendente'}</label><p className="readback-template">{pending.readback}</p><div><input id="readback" value={text} placeholder="Digite ou use a mensagem sugerida" onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.nativeEvent.isComposing||e.keyCode===229)return;if(e.key==='Enter'){e.preventDefault();transmit();}}}/><button aria-label="Transmitir cotejamento" disabled={!text.trim()} onClick={transmit}><Send size={16}/></button></div><div className="readback-tools"><button onClick={()=>setText(pending.readback)}><Copy size={12}/>Usar mensagem sugerida</button><button onClick={()=>{mutate(cancelRadio);setText('');}}>Cancelar</button></div></div>:<div className="radio-actions">{availableActions(s,radio.sector).map(kind=><button key={kind} onClick={()=>mutate(r=>requestRadio(r,kind,sim.current))}><Send size={12}/>{actionLabels[kind]}</button>)}{!availableActions(s,radio.sector).length&&<p>Sem solicitações para esta fase. Selecione o setor apropriado.</p>}</div>}
 <div className="clearance-strip" aria-label="Autorizações registradas">{[[s.pushbackClearance,'Pushback'],[s.taxiClearance,'Táxi'],[s.lineUpClearance,'Alinhamento'],[s.clearance,'Decolagem'],[s.landingClearance,'Pouso']].filter(([active])=>active).map(([,label])=><span key={String(label)}><Check size={11}/>{label}</span>)}</div>
 </section>;
}
