import { geoToWorld,worldToGeo,surfaceDistance } from '../world/geodesy';
export { geoToWorld } from '../world/geodesy';
/** Continuous local metric world. +X east, +Z south; GRU is the (0,0) origin. */
export type AirportId = 'SBGR' | 'SBSP' | 'LPPT' | 'KJFK' | 'RJTT' | 'FACT' | 'YSSY';
export type SpawnPoint = 'gate' | 'runway' | 'approach';
export type Point2 = { x: number; z: number };
export type Runway = { center: Point2; length: number; width: number; rotation: number; chartScale?: number; ends: readonly [string, string] };
export type Airport = {
  id: AirportId; iata: string; name: string; shortName: string;
  latitude: number; longitude: number; world: Point2;
  runway: Runway; runways: readonly Runway[];
  gate: Point2; gateHeading: number; primaryRunwayLabel: string; schematic?: boolean; country?: string;
};
const gruGeo={latitude:-23.43556,longitude:-46.47306};
export function distanceMeters(a: Point2, b: Point2): number { return Math.hypot(a.x - b.x, a.z - b.z); }
/** Runways extend along local Z, then rotate clockwise in world XZ. */
export function runwayPoint(runway: Runway, lateral: number, longitudinal: number): Point2 {
  const c = Math.cos(runway.rotation), s = Math.sin(runway.rotation);
  return { x: runway.center.x + (lateral * c + longitudinal * s) * (runway.chartScale ?? 1),
    z: runway.center.z - lateral * s + longitudinal * c };
}
export function runwayCoordinates(runway: Runway, point: Point2): Point2 {
  const dx = (point.x - runway.center.x) / (runway.chartScale ?? 1), dz = point.z - runway.center.z;
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
function schematicAirport(id:AirportId,iata:string,name:string,latitude:number,longitude:number,country:string):Airport {
 const world=geoToWorld(latitude,longitude),chartScale=Math.cos((-23.43556-23.6261)/2*Math.PI/180)/Math.cos(latitude*Math.PI/180);
 const runway:Runway={center:world,length:2000,width:45,rotation:0,chartScale,ends:['TESTE S','TESTE N']};
 return {id,iata,name,shortName:name,latitude,longitude,world,runway,runways:[runway],gate:runwayPoint(runway,-350,225),gateHeading:-Math.PI/2,primaryRunwayLabel:'TESTE N',schematic:true,country};
}
export const airports: Record<AirportId, Airport> = {
 LPPT:schematicAirport('LPPT','LIS','Lisboa',38.7813,-9.13592,'Portugal'),
 KJFK:schematicAirport('KJFK','JFK','Nova York',40.639447,-73.779317,'Estados Unidos'),
 RJTT:schematicAirport('RJTT','HND','Tóquio',35.549678,139.786958,'Japão'),
 FACT:schematicAirport('FACT','CPT','Cidade do Cabo',-33.97403,18.604333,'África do Sul'),
 YSSY:schematicAirport('YSSY','SYD','Sydney',-33.946098,151.177002,'Austrália'),
  SBGR: {id:'SBGR',iata:'GRU',name:'Guarulhos Internacional',shortName:'Guarulhos',...gruGeo,world:{x:0,z:0},runway:gruMain,runways:[gruMain,gruOther],gate:{x:-350,z:225},gateHeading:-Math.PI/2,primaryRunwayLabel:'10L'},
  SBSP: {id:'SBSP',iata:'CGH',name:'Congonhas',shortName:'Congonhas',latitude:-23.6261,longitude:-46.6564,world:cghWorld,runway:cghMain,runways:[cghMain,cghAux],gate:runwayPoint(cghMain,-350,225),gateHeading:cghMain.rotation-Math.PI/2,primaryRunwayLabel:'35L'},
};
export const airportList=[airports.SBGR,airports.SBSP,airports.LPPT,airports.KJFK,airports.RJTT,airports.FACT,airports.YSSY];
export function airportForPoint(point: Point2): Airport {
  const geo=worldToGeo(point);return airportList.reduce((best,a)=>surfaceDistance(geo,a)<surfaceDistance(geo,best)?a:best,airportList[0]);
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
/** World-aligned conservative bounding rectangles of structures rotated with CGH runway.
 * Kept separate from visual meshes so collision and service logic share coordinates. */
function cghStructure(lateral: number, along: number, width: number, length: number, height: number) {
  const center=runwayPoint(cghMain,lateral,along);
  const c=Math.abs(Math.cos(cghMain.rotation)),s=Math.abs(Math.sin(cghMain.rotation));
  return {x:center.x,z:center.z,w:width*c+length*s,d:width*s+length*c,h:height};
}
export const congonhasStructures = [
  cghStructure(-468,10,78,524,23), // terminal and roof
  cghStructure(-562,-310,100,103,18), // hangar
  cghStructure(-565,315,102,90,18), // service building
  cghStructure(-455,-255,35,35,52), // control tower
] as const;
