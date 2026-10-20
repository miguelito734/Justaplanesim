import { initialGround, type GroundState } from './ground';
import { getSpawn, type AirportId, type SpawnPoint } from './airports';
import type { Aircraft } from './aircraft';
import type { EngineStatus } from './commands';
import type { AutonomousState } from './autonomous';
export { buildings } from './ground';
export { issue, acceptReadback, type Sector, type Clearance } from './atc';
export { stepAutonomous as step, configureAutonomous } from './autonomous';

export type FlightState = {
 airportId: AirportId; x: number; y: number; z: number; speed: number; vertical: number; heading: number;
 pitch: number; bank: number; throttle: number; engine: EngineStatus; engineTimer: number; rpm: number;
 systemMessage: string; ground: GroundState; departureClearance: boolean; startupClearance: boolean;
 pushbackClearance: boolean; lineUpClearance: boolean; approachClearance: boolean; gear: boolean;
 flaps: number; fuel: number; crashed: boolean; departureChecked: boolean; airborne: boolean;
 landed: boolean; distance: number; elapsed: number; warning: string; clearance: boolean;
 landingClearance: boolean; taxiClearance: boolean; violations: number; auto: AutonomousState | null;
};
export function initialState(a: Aircraft, spawn: SpawnPoint = 'gate', airportId: AirportId = 'SBGR'): FlightState {
 const position = getSpawn(airportId, spawn);
 return {
  airportId, x: position.x, y: 0, z: position.z, speed: 0, vertical: 0,
  heading: position.heading, pitch: 0, bank: 0, throttle: 0, engine: 'off', engineTimer: 0, rpm: 0,
  systemMessage: 'Motores desligados. Solicite autorização de acionamento no rádio GND.',
  ground: initialGround(airportId), departureClearance: false, startupClearance: false,
  pushbackClearance: false, lineUpClearance: false, approachClearance: false, gear: true,
  flaps: 0, fuel: a.fuel * .9, crashed: false, departureChecked: false, airborne: false,
  landed: false, distance: 0, elapsed: 0, warning: '', clearance: false,
  landingClearance: false, taxiClearance: false, violations: 0, auto: null,
 };
}
