/** Spherical Earth; the legacy chart is storage only, never a world renderer.
 * +X east, +Z south. Radius follows the existing 0.3 regional projection.
 * WGS84 ellipsoidal/geoid heights are deliberately not claimed. */
export const EARTH_RADIUS = 6371000;
export const DEG = Math.PI / 180;
export type GeoPoint = { latitude: number; longitude: number };
export type Vec3 = { x: number; y: number; z: number };
export const GRU = { latitude: -23.43556, longitude: -46.47306 };
const chartCos = Math.cos((-23.43556 - 23.6261) / 2 * DEG);
export const wrapLongitude = (v: number) => ((v + 180) % 360 + 360) % 360 - 180;
export function geoToWorld(latitude: number, longitude: number) {
 return { x: (longitude - GRU.longitude) * DEG * EARTH_RADIUS * chartCos,
  z: -(latitude - GRU.latitude) * DEG * EARTH_RADIUS };
}
export function worldToGeo(p: { x: number; z: number }): GeoPoint {
 return { latitude: Math.max(-90, Math.min(90, GRU.latitude - p.z / (DEG * EARTH_RADIUS))),
  longitude: wrapLongitude(GRU.longitude + p.x / (DEG * EARTH_RADIUS * chartCos)) };
}
export function surfaceDistance(a: GeoPoint, b: GeoPoint) {
 const p=a.latitude*DEG,q=b.latitude*DEG,dp=q-p,dl=(b.longitude-a.longitude)*DEG;
 const h=Math.sin(dp/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(dl/2)**2;
 return 2*EARTH_RADIUS*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
}
export function bearing(a:GeoPoint,b:GeoPoint) {
 const p=a.latitude*DEG,q=b.latitude*DEG,d=(b.longitude-a.longitude)*DEG;
 return Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d));
}
/** Direct great-circle solution; returns the transported heading, including at poles. */
export function destination(a:GeoPoint,heading:number,meters:number) {
 if(meters===0)return {...a,heading};
 const p=a.latitude*DEG,l=a.longitude*DEG,d=meters/EARTH_RADIUS;
 const q=Math.asin(Math.max(-1,Math.min(1,Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(heading))));
 const lon=l+Math.atan2(Math.sin(heading)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(q));
 const next={latitude:q/DEG,longitude:wrapLongitude(lon/DEG)};
 return {...next,heading:Math.atan2(Math.sin(bearing(next,a)+Math.PI),Math.cos(bearing(next,a)+Math.PI))};
}
/** Right-handed Earth frame: +Y north, +X at Greenwich, -Z at 90° east.
 * East/up/south must form a proper rotation for Three.js quaternions. */
export function toECEF(p:GeoPoint,height=0):Vec3 {
 const r=EARTH_RADIUS+height,lat=p.latitude*DEG,lon=p.longitude*DEG,c=Math.cos(lat);
 return {x:r*c*Math.cos(lon),y:r*Math.sin(lat),z:-r*c*Math.sin(lon)};
}
export function fromECEF(v:Vec3):GeoPoint {
 return {latitude:Math.atan2(v.y,Math.hypot(v.x,v.z))/DEG,longitude:Math.atan2(-v.z,v.x)/DEG};
}
export function basis(p:GeoPoint) {
 const lat=p.latitude*DEG,lon=p.longitude*DEG;
 return {east:{x:-Math.sin(lon),y:0,z:-Math.cos(lon)},
 up:{x:Math.cos(lat)*Math.cos(lon),y:Math.sin(lat),z:-Math.cos(lat)*Math.sin(lon)},
 south:{x:Math.sin(lat)*Math.cos(lon),y:-Math.cos(lat),z:-Math.sin(lat)*Math.sin(lon)}};
}
export const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
export function ecefToLocal(v:Vec3,origin:GeoPoint):Vec3 {
 const c=toECEF(origin),b=basis(origin),d={x:v.x-c.x,y:v.y-c.y,z:v.z-c.z};
 return {x:dot(d,b.east),y:dot(d,b.up),z:dot(d,b.south)};
}
export function localToECEF(v:Vec3,origin:GeoPoint):Vec3 {
 const c=toECEF(origin),b=basis(origin);
 return {x:c.x+v.x*b.east.x+v.y*b.up.x+v.z*b.south.x,
 y:c.y+v.x*b.east.y+v.y*b.up.y+v.z*b.south.y,
 z:c.z+v.x*b.east.z+v.y*b.up.z+v.z*b.south.z};
}
