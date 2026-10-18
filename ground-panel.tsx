'use client';
import { Truck, X, Radio, Users } from 'lucide-react';
import type { Aircraft } from '@/lib/sim/aircraft';
import type { FlightState } from '@/lib/sim/engine';
import { groundReason, requestPushback, requestService, releaseService, vehicleLabels, type VehicleKind } from '@/lib/sim/ground';
export function GroundPanel({s,sim,a,close,refresh,radio,passengers}:{s:FlightState;sim:React.RefObject<FlightState>;a:Aircraft;close:()=>void;refresh:()=>void;radio:()=>void;passengers:()=>void}){
 const g=s.ground;const busy=!!groundReason(s,a);const pushReason=groundReason(s,a,true);
 const serviceGroups:{title:string;description:string;kinds:VehicleKind[]}[]=[{title:'Apoio à aeronave',description:'Energia, combustível e manutenção em solo',kinds:['gpu','fuel','water','lavatory']},{title:'Embarque e bagagens',description:'Acesso e movimentação de equipamentos',kinds:['stairs','belt','baggage']}];
 const action=(fn:()=>void)=>{fn();refresh();};
 return <section className="ground-panel glass-panel" aria-label="Serviços de solo"><header><div><Truck size={17}/><strong>Serviços de solo · G8</strong></div><button aria-label="Fechar serviços de solo" onClick={close}><X size={17}/></button></header>
 <div className="ground-scroll"><p className="ground-intro">Aeronave parada, motores desligados. Um equipamento por vez para manter a área livre.</p>
 <div className="ground-section-heading"><strong>Manobra no pátio</strong><span>Autorização e reboque</span></div><div className="ground-progress"><span>PUSHBACK</span><strong>{{idle:'Disponível',approaching:'Trator se aproximando',connected:'Conectado',pushing:'Recuando',waiting:'Aguardando área livre',returning:'Trator se retirando',completed:'Concluído'}[g.pushback.phase]}</strong><small>{Math.round(g.pushback.moved)} m de recuo real</small></div>
 <div className="ground-actions"><button className="secondary-button" onClick={radio}><Radio size={14}/>Pedir autorização GND</button><button className="primary-button" disabled={!!pushReason} title={pushReason} onClick={()=>action(()=>{requestPushback(sim.current,a);})}>Iniciar pushback</button></div>
 {pushReason&&<p className="action-reason">{pushReason}</p>}
 <div className="ground-service-groups">{serviceGroups.map(group=><section className="ground-service-group" key={group.title}><div className="ground-section-heading"><strong>{group.title}</strong><span>{group.description}</span></div><div className="service-grid">{group.kinds.map(kind=><button disabled={busy} key={kind} onClick={()=>action(()=>{requestService(sim.current,a,kind);})}><Truck size={14}/><span>{vehicleLabels[kind]}</span></button>)}</div></section>)}</div>
 {g.service&&<div className="service-active"><strong>{vehicleLabels[g.service.kind]}</strong><span>{{approaching:'Aproximando',working:'Em serviço',returning:'Retornando'}[g.service.phase]}</span>{g.service.phase!=='returning'&&<button onClick={()=>action(()=>releaseService(sim.current))}>Desconectar / retirar</button>}</div>}
 <p className="ground-feedback" role="status">{g.message}</p><p className="ground-disclaimer">GPU, água, lavatório e bagagens: interação visual. Abastecimento altera o combustível real da simulação.</p>
 <button className="secondary-button full-width" onClick={passengers}><Users size={14}/>Passageiros e bagagens</button></div>
 </section>;
}
