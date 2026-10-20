import { airports, type AirportId } from '../sim/airports';
import type { Aircraft } from '../sim/aircraft';
import { bearing, DEG, surfaceDistance, wrapLongitude, type GeoPoint } from '../world/geodesy';

export type FlightMode = 'realista' | 'normal' | 'rapido';
export type PlannedWaypoint = GeoPoint & { id: string; distanceKm: number };
export type FlightPlan = { from: AirportId; to: AirportId; aircraftId: string; mode: FlightMode; waypoints: PlannedWaypoint[] };

export function flightDistanceKm(from:AirportId,to:AirportId) { return surfaceDistance(airports[from],airports[to])/1000; }
/** Estimates are for planning only. Flight physics and sim clock remain unchanged. */
export function estimatedMinutes(from: AirportId,to: AirportId,a:Pick<Aircraft,'cruise'>,mode:FlightMode) {
 const distance=flightDistanceKm(from,to);
 const realistic=Math.max(1,Math.round(distance/(Math.max(1,a.cruise)*1.852)*60));
 return mode==='realista'?realistic:mode==='normal'?Math.max(1,Math.round(realistic/2)):realistic<=30?5:15;
}
export function formatDuration(minutes:number) {return `${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}min`;}
/** Spherical interpolation, not invented published IFR fixes. */
export function greatCirclePoint(a:GeoPoint,b:GeoPoint,fraction:number):GeoPoint {
 const lat1=a.latitude*DEG,lon1=a.longitude*DEG,lat2=b.latitude*DEG,lon2=b.longitude*DEG;
 const delta=surfaceDistance(a,b)/6371000;
 if(delta<1e-8) return {...a};
 const sin=Math.sin(delta);
 const w1=Math.sin((1-fraction)*delta)/sin,w2=Math.sin(fraction*delta)/sin;
 const x=w1*Math.cos(lat1)*Math.cos(lon1)+w2*Math.cos(lat2)*Math.cos(lon2);
 const y=w1*Math.cos(lat1)*Math.sin(lon1)+w2*Math.cos(lat2)*Math.sin(lon2);
 const z=w1*Math.sin(lat1)+w2*Math.sin(lat2);
 return {latitude:Math.atan2(z,Math.hypot(x,y))/DEG,longitude:wrapLongitude(Math.atan2(y,x)/DEG)};
}
export function generateGpsWaypoints(from:AirportId,to:AirportId):PlannedWaypoint[]{
 if(from===to) return [];
 const start=airports[from],end=airports[to],total=flightDistanceKm(from,to);
 // Limit route to a readable number of named GPS positions; no unverified ICAO fixes.
 const segments=Math.min(10,Math.max(2,Math.ceil(total/175)));
 return Array.from({length:segments-1},(_,i)=>({
  ...greatCirclePoint(start,end,(i+1)/segments),
  id:`GPS${String(i+1).padStart(2,'0')}`,
  distanceKm:total*(i+1)/segments
 }));
}
export function flightHeading(from:AirportId,to:AirportId){return (bearing(airports[from],airports[to])/DEG+360)%360;}
