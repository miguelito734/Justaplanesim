/** Continuous local metric world. +X east, +Z south; GRU is the (0,0) origin. */
export type AirportId = 'SBGR' | 'SBSP';
export type SpawnPoint = 'gate' | 'runway' | 'approach';
export type Point2 = { x: number; z: number };
export type Runway = { center: Point2; length: number; width: number; rotation: number; ends: readonly [string, string] };
export type Airport = {
  id: AirportId; iata: string; name: string; shortName: string;
  latitude: number; longitude: number; world: Point2;
  runway: Runway; runways: readonly Runway[];
  gate: Point2; gateHeading: number; primaryRunwayLabel: string;
};
const R = 6371000;
const gruGeo = { latitude: -23.43556, longitude: -46.47306 };
const meanLatitude = (-23.43556 - 23.6261) / 2;
/** Equirectangular projection; less than 0.1% error over the local São Paulo region. */
export function geoToWorld(latitude: number, longitude: number): Point2 {
  return {
    x: (longitude - gruGeo.longitude) * Math.PI / 180 * R * Math.cos(meanLatitude * Math.PI / 180),
    z: -(latitude - gruGeo.latitude) * Math.PI / 180 * R,
  };
}
export function distanceMeters(a: Point2, b: Point2): number { return Math.hypot(a.x - b.x, a.z - b.z); }
/** Runways extend along local Z, then rotate clockwise in world XZ. */
export function runwayPoint(runway: Runway, lateral: number, longitudinal: number): Point2 {
  const c = Math.cos(runway.rotation), s = Math.sin(runway.rotation);
  return { x: runway.center.x + lateral * c + longitudinal * s,
    z: runway.center.z - lateral * s + longitudinal * c };
}
export function runwayCoordinates(runway: Runway, point: Point2): Point2 {
  const dx = point.x - runway.center.x, dz = point.z - runway.center.z;
  return { x: dx * Math.cos(runway.rotation) - dz * Math.sin(runway.rotation),
    z: dx * Math.sin(runway.rotation) + dz * Math.cos(runway.rotation) };
}
const gruMain: Runway = { center: {x:140,z:0}, length: 1840, width:40, rotation:0, ends:['10L','28R'] };
const gruOther: Runway = { center: {x:-140,z:0}, length:1840, width:40, rotation:0, ends:['10R','28L'] };
const cghWorld = geoToWorld(-23.6261,-46.6564);
// Congonhas' runways are represented schematically at real approximate dimensions.
// Rotated ~31° east of south, instead of aligning to the existing GRU axes.
const cghMain: Runway = {center:{x:cghWorld.x-95,z:cghWorld.z},length:1940,width:45,rotation:31*Math.PI/180,ends:['17R','35L']};
const cghAux: Runway = {center:{x:cghWorld.x+110,z:cghWorld.z},length:1435,width:45,rotation:31*Math.PI/180,ends:['17L','35R']};
export const airports: Record<AirportId, Airport> = {
  SBGR: {id:'SBGR',iata:'GRU',name:'Guarulhos Internacional',shortName:'Guarulhos',...gruGeo,world:{x:0,z:0},runway:gruMain,runways:[gruMain,gruOther],gate:{x:-350,z:225},gateHeading:-Math.PI/2,primaryRunwayLabel:'10L'},
  SBSP: {id:'SBSP',iata:'CGH',name:'Congonhas',shortName:'Congonhas',latitude:-23.6261,longitude:-46.6564,world:cghWorld,runway:cghMain,runways:[cghMain,cghAux],gate:{x:cghWorld.x-350,z:cghWorld.z+225},gateHeading:-Math.PI/2,primaryRunwayLabel:'35L'},
};
export const airportList = [airports.SBGR, airports.SBSP] as const;
export function airportForPoint(point: Point2): Airport {
  return distanceMeters(point,airports.SBSP.world)<distanceMeters(point,airports.SBGR.world)?airports.SBSP:airports.SBGR;
}
export function isOnRunway(point: Point2, airportId?: AirportId, margin = 0): boolean {
  const candidates = airportId ? airports[airportId].runways : airportList.flatMap(a=>a.runways);
  return candidates.some(runway=>{const local=runwayCoordinates(runway,point);
    return Math.abs(local.x)<=runway.width/2+margin&&Math.abs(local.z)<=runway.length/2+margin;});
}
/** Preserves the existing GRU runway / gate positions and headings. */
export function getSpawn(airportId: AirportId, point: SpawnPoint) {
  const airport = airports[airportId];
  if(point==='gate') return {...airport.gate,heading:airport.gateHeading,y:0};
  const runway = airport.runway;
  const local=runwayPoint(runway,0,point==='runway'?runway.length/2-160:runway.length/2+1280);
  // The existing GRU test approach starts at 2,200m, rather than 2,200m from the runway end.
  const position=airportId==='SBGR'&&point==='approach'?{x:140,z:2200}:local;
  return {...position,heading:-runway.rotation,y:point==='approach'?150:0};
}
/** Airports remain separately modeled; no structures are added along the route. */
export const congonhasStructures = [
  { x:cghWorld.x-465, z:cghWorld.z+10, w:72, d:515, h:23 }, // terminal
  { x:cghWorld.x-560, z:cghWorld.z-310, w:95, d:100, h:16 }, // hangar
  { x:cghWorld.x-565, z:cghWorld.z+315, w:95, d:85, h:16 }, // services
  { x:cghWorld.x-455, z:cghWorld.z-255, w:28, d:28, h:44 }, // control tower
] as const;
