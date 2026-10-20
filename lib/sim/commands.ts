import type { Aircraft } from './aircraft';
import type { FlightState } from './engine';

export type EngineStatus = 'off' | 'starting' | 'running' | 'failed';
export const engineLabels: Record<EngineStatus, string> = { off: 'Desligado', starting: 'Em partida', running: 'Ligado', failed: 'Partida interrompida' };
export type AircraftCommand = {type:'engine'};
export function serviceBusy(s: FlightState) {
  return ['approaching','connected','pushing','returning','waiting'].includes(s.ground.pushback.phase) || s.ground.service !== null;
}
export function commandAircraft(s: FlightState, a: Aircraft, command: AircraftCommand): string {
  const finish=(message:string)=>(s.systemMessage=message);
  if(s.crashed)return finish('Operação interrompida. Inicie outro voo.');
  if(a.status==='Modelo visual')return finish('Modelo sem dinâmica autônoma implementada.');
  if(command.type==='engine'){
    if(s.engine==='running'||s.engine==='starting'){
      if(s.airborne||s.y>1||s.speed>1)return finish('Desligamento bloqueado: aeronave em deslocamento.');
      s.engine='off';s.engineTimer=0;s.throttle=0;
      return finish('Motores desligados.');
    }
    if(!s.startupClearance && !s.auto?.phase.includes('completed'))return finish('Solicite autorização de acionamento e coteje no GND.');
    if(s.fuel<=0){s.engine='failed';return finish('Partida recusada: sem combustível.');}
    if(s.throttle>.05)return finish('Potência incompatível com partida dos motores.');
    if(serviceBusy(s))return finish('Aguarde o término dos serviços e do pushback.');
    s.engine='starting';s.engineTimer=0;
    return finish('Acionamento iniciado. A aeronave fará o táxi após autorização.');
  }
  return finish('Comando não disponível.');
}
export function updateEngine(s: FlightState, a: Aircraft, dt: number) {
  if (s.engine === 'starting') {
    if (s.fuel <= 0 || s.throttle > .05 || serviceBusy(s)) {
      s.engine = 'failed'; s.engineTimer = 0; s.systemMessage = 'Partida interrompida: verifique combustível, manete e serviços.';
    } else {
      s.engineTimer += dt;
      if (s.engineTimer >= (a.shape === 'light' ? 2 : 4)) { s.engine = 'running'; s.systemMessage = 'Motores estabilizados. Aguarde a sequência automática e as autorizações ATC.'; }
    }
  }
  if (s.fuel <= 0 && s.engine === 'running') { s.engine = 'failed'; s.systemMessage = 'Motores sem combustível.'; }
  const target = s.engine === 'running' ? .22 + .78 * s.throttle : s.engine === 'starting' ? .16 : 0;
  s.rpm += (target - s.rpm) * (1 - Math.exp(-dt * 2));
}
export function visualTargets(s: FlightState) {
  return { gear: s.gear ? 1 : 0, flaps: s.flaps * Math.PI / 18, rotation: s.rpm * 65, wheels: s.y < .1 ? s.speed : 0 };
}
export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('textarea,select,[contenteditable="true"],input:not([type="range"]):not([type="checkbox"]):not([type="button"])');
}
