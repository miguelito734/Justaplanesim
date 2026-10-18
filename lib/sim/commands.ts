import type { Aircraft } from './aircraft';
import type { FlightState } from './engine';

export type EngineStatus = 'off' | 'starting' | 'running' | 'failed';
export const engineLabels: Record<EngineStatus, string> = { off: 'Desligado', starting: 'Em partida', running: 'Ligado', failed: 'Partida interrompida' };
export type AircraftCommand = { type: 'engine' } | { type: 'throttle'; value: number } | { type: 'gear' } | { type: 'flaps' };
export function serviceBusy(s: FlightState) {
  return ['approaching', 'connected', 'pushing', 'returning', 'waiting'].includes(s.ground.pushback.phase) || s.ground.service !== null;
}
export function commandAircraft(s: FlightState, a: Aircraft, command: AircraftCommand): string {
  const finish = (message: string) => (s.systemMessage = message);
  if (s.crashed) return finish('Operação interrompida. Reposicione a aeronave.');
  if (a.status === 'Modelo visual') return finish('Esta categoria ainda não possui dinâmica implementada.');
  switch (command.type) {
    case 'engine':
      if (s.engine === 'running' || s.engine === 'starting') {
        const interrupted = s.engine === 'starting';
        s.engine = 'off'; s.engineTimer = 0; s.throttle = 0;
        return finish(interrupted ? 'Partida cancelada pelo piloto.' : 'Motores desligados. Potência em zero.');
      }
      if (s.fuel <= 0) { s.engine = 'failed'; return finish('Partida recusada: sem combustível.'); }
      if (s.throttle > .05) return finish('Reduza a potência para até 5% antes da partida.');
      if (serviceBusy(s)) return finish('Aguarde a retirada dos equipamentos de solo.');
      s.engine = 'starting'; s.engineTimer = 0;
      return finish('Partida iniciada. Aguarde a estabilização dos motores.');
    case 'throttle':
      if (!Number.isFinite(command.value)) return finish('Potência inválida.');
      if (serviceBusy(s)) { s.throttle = 0; return finish('Potência bloqueada durante serviços de solo.'); }
      s.throttle = Math.max(0, Math.min(1, command.value));
      return finish(s.engine === 'running' ? `Potência selecionada: ${Math.round(s.throttle * 100)}%.` : 'Manete ajustada; sem empuxo enquanto os motores não estiverem ligados.');
    case 'gear':
      if (s.y < 2 || serviceBusy(s)) return finish('Recolhimento bloqueado: aeronave em solo.');
      s.gear = !s.gear;
      return finish(s.gear ? 'Estendendo trem de pouso.' : 'Recolhendo trem de pouso.');
    case 'flaps':
      s.flaps = (s.flaps + 1) % 3;
      return finish(`Flaps selecionados: ${s.flaps * 10}°. `);
  }
}
export function updateEngine(s: FlightState, a: Aircraft, dt: number) {
  if (s.engine === 'starting') {
    if (s.fuel <= 0 || s.throttle > .05 || serviceBusy(s)) {
      s.engine = 'failed'; s.engineTimer = 0; s.systemMessage = 'Partida interrompida: verifique combustível, manete e serviços.';
    } else {
      s.engineTimer += dt;
      if (s.engineTimer >= (a.shape === 'light' ? 2 : 4)) { s.engine = 'running'; s.systemMessage = 'Motores estabilizados. Aumente a potência para movimentar a aeronave.'; }
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
