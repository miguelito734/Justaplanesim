import { airports, type AirportId } from '../sim/airports';
import type { Aircraft } from '../sim/aircraft';
import { bearing, DEG, surfaceDistance, wrapLongitude, type GeoPoint } from '../world/geodesy';

export type FlightMode = 'realista' | 'normal' | 'rapido';
export type PlannedWaypoint = GeoPoint & { id: string; distanceKm: number };
export type FlightPlan = { from: AirportId; to: AirportId; aircraftId: string; mode: FlightMode; waypoints: PlannedWaypoint[] };
export type FlightScope = 'free' | 'career';
export const flightDistanceKm = (from: AirportId, to: AirportId) => surfaceDistance(airports[from], airports[to]) / 1000;

/** The source catalogue includes approximate cruise airspeeds but has no airline schedules.
 * This is an explicitly MODELLED block-time estimate, NOT a published flight duration:
 * still air + great-circle distance at catalogue cruise speed + 12 min ground/terminal allowance.
 * No estimate is returned if required data are absent. */
export function realFlightMinutes(from: AirportId, to: AirportId, a: Pick<Aircraft, 'cruise'>): number | null {
  if (from === to || !Number.isFinite(a.cruise) || a.cruise <= 0) return null;
  return Math.max(1, Math.ceil(flightDistanceKm(from, to) / (a.cruise * 1.852) * 60 + 12));
}
export function modeFlightMinutes(real: number | null, mode: FlightMode, scope: FlightScope = 'free'): number | null {
  if (real === null) return null;
  if (scope === 'career' || mode === 'realista') return real;
  if (mode === 'normal') return real / 2;
  return real <= 30 ? 5 : 15;
}
export function estimatedMinutes(from: AirportId, to: AirportId, a: Pick<Aircraft, 'cruise'>, mode: FlightMode) {
  return modeFlightMinutes(realFlightMinutes(from, to, a), mode);
}
export const formatDuration = (minutes: number | null) => minutes === null ? 'Indisponível' : `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, '0')}min`;

/** Aircraft capability: ranges below are manufacturer / C152 POH figures, not assurances
 * of dispatch feasibility. Apply 20% planning margin. Where unverified, permit only
 * a short local test <=150 km and explicitly disclose that the range is unknown. */
export const rangeDataKm: Record<string, { km: number; source: string }> = {
  c152: { km: 320 * 1.852, source: 'Cessna 152 POH (24.5 gal, 75% power, with stated reserve)' },
  a320: { km: 6200, source: 'Airbus A320ceo technical figures' },
  e195: { km: 5556, source: 'Embraer E195-E2 specification' },
  b777: { km: 13650, source: 'Boeing 777-300ER technical highlights' },
};
export function aircraftCompatibility(a: Aircraft, from: AirportId, to: AirportId): { available: boolean; reason: string; verifiedRange: boolean } {
  if (a.status !== 'Física básica' || a.engines < 1 || a.thrust <= 0) return { available: false, reason: 'Dinâmica de voo autônomo indisponível para este modelo.', verifiedRange: false };
  if (from === to) return { available: false, reason: 'Origem e destino devem ser diferentes.', verifiedRange: false };
  const distance = flightDistanceKm(from, to);
  const known = rangeDataKm[a.id];
  if (known) return distance <= known.km * .8
    ? { available: true, reason: `Alcance publicado: ${Math.round(known.km)} km; margem de planejamento de 20%. Não substitui despacho real.`, verifiedRange: true }
    : { available: false, reason: `Rota de ${Math.round(distance)} km excede 80% do alcance publicado (${Math.round(known.km)} km).`, verifiedRange: true };
  return distance <= 150
    ? { available: true, reason: 'Alcance não validado: liberado somente para teste local de até 150 km.', verifiedRange: false }
    : { available: false, reason: 'Alcance não documentado no catálogo. Voos longos bloqueados até validar os dados do modelo.', verifiedRange: false };
}

/** Great-circle interpolation, not invented published IFR fixes. */
export function greatCirclePoint(a: GeoPoint, b: GeoPoint, fraction: number): GeoPoint {
  const lat1 = a.latitude * DEG, lon1 = a.longitude * DEG, lat2 = b.latitude * DEG, lon2 = b.longitude * DEG;
  const delta = surfaceDistance(a, b) / 6371000;
  if (delta < 1e-8) return { ...a };
  const sin = Math.sin(delta);
  const w1 = Math.sin((1 - fraction) * delta) / sin, w2 = Math.sin(fraction * delta) / sin;
  const x = w1 * Math.cos(lat1) * Math.cos(lon1) + w2 * Math.cos(lat2) * Math.cos(lon2);
  const y = w1 * Math.cos(lat1) * Math.sin(lon1) + w2 * Math.cos(lat2) * Math.sin(lon2);
  const z = w1 * Math.sin(lat1) + w2 * Math.sin(lat2);
  return { latitude: Math.atan2(z, Math.hypot(x, y)) / DEG, longitude: wrapLongitude(Math.atan2(y, x) / DEG) };
}
export function generateGpsWaypoints(from: AirportId, to: AirportId): PlannedWaypoint[] {
  if (from === to) return [];
  const start = airports[from], end = airports[to], total = flightDistanceKm(from, to);
  const segments = Math.min(10, Math.max(2, Math.ceil(total / 175)));
  return Array.from({ length: segments - 1 }, (_, i) => ({
    ...greatCirclePoint(start, end, (i + 1) / segments),
    id: `GPS${String(i + 1).padStart(2, '0')}`, distanceKm: total * (i + 1) / segments,
  }));
}
export function flightHeading(from: AirportId, to: AirportId) { return (bearing(airports[from], airports[to]) / DEG + 360) % 360; }
