'use client';
import { ArrowUp, ArrowDown } from 'lucide-react';
import type { FlightState } from '@/lib/sim/engine';
import type { Aircraft } from '@/lib/sim/aircraft';
import { flightPhaseLabels } from '@/lib/sim/autonomous';
export function Instruments({s,a}:{s:FlightState;a:Aircraft}) {
 const heading=((s.heading*180/Math.PI)%360+360)%360;
 return <section className="instruments" aria-label="Instrumentos de voo — somente leitura">
  <div className="flight-identity"><span className="live-dot"/><div><strong>PT-JPS</strong><span>{s.auto?flightPhaseLabels[s.auto.phase]:'AGUARDANDO PLANO'}</span></div><span className="aircraft-code">{a.id.toUpperCase()}</span></div>
  <div className="instrument"><label>VELOCIDADE <small>IAS SIM.</small></label><div>{Math.round(s.speed*1.94384).toString().padStart(3,'0')}<span>kt</span></div><div className="meter-lines"/></div>
  <div className="instrument"><label>ALTITUDE <small>AGL</small></label><div>{Math.round(s.y*3.28084).toString().padStart(3,'0')}<span>ft</span></div><span className="instrument-sub">Terreno simplificado, sem MSL real</span></div>
  <div className="attitude"><div className="attitude-disc" style={{transform:`rotate(${s.bank*180/Math.PI}deg)`}}><div className="horizon-line" style={{transform:`translateY(${s.pitch*50}px)`}}/></div><span>— ━ —</span></div>
  <div className="instrument"><label>RUMO <small>HDG</small></label><div>{Math.round(heading).toString().padStart(3,'0')}<span>°</span></div><span className="instrument-sub">{s.vertical>=0?<ArrowUp size={10}/>:<ArrowDown size={10}/>} {Math.abs(Math.round(s.vertical*196.85))} ft/min</span></div>
  <div className="instrument power"><label>POTÊNCIA <small>{s.engine==='running'?'ATIVO':s.engine==='starting'?'PARTINDO':'DESLIGADO'}</small></label><div>{Math.round(s.throttle*100)}<span>%</span></div><span className="instrument-sub">Gerenciada pelo voo autônomo</span></div>
  <div className="configuration"><div><span>TREM</span><b className={s.gear?'green':''}>{s.gear?'BAIXO':'RECOLHIDO'}</b></div><div><span>FLAPS</span><b>{s.flaps*10}°</b></div><div className="fuel-line"><span>COMBUSTÍVEL</span><strong>{a.fuel?Math.round(s.fuel/a.fuel*100):0}%</strong></div></div>
 </section>;
}
