import * as THREE from 'three';
import { basis, ecefToLocal, toECEF, localToECEF, worldToGeo, type GeoPoint, type Vec3 } from './geodesy';
import { airportList, airportForPoint } from '../sim/airports';
export type RenderFrame={origin:GeoPoint;revision:number};
export const vector=(v:Vec3)=>new THREE.Vector3(v.x,v.y,v.z);
export function ecefRotation(origin:GeoPoint) {
 const b=basis(origin);
 return new THREE.Matrix4().set(b.east.x,b.east.y,b.east.z,0,b.up.x,b.up.y,b.up.z,0,b.south.x,b.south.y,b.south.z,0,0,0,0,1);
}
export function tangentQuaternion(point:GeoPoint,origin:GeoPoint) {
 const b=basis(point),m=new THREE.Matrix4().makeBasis(vector(b.east),vector(b.up),vector(b.south));
 return new THREE.Quaternion().setFromRotationMatrix(ecefRotation(origin).multiply(m));
}
/** Keep the original flat airport geometry and wheel contact locally. Blend to sphere
 * beyond the airport instead of translating simulation altitude or colliders. */
export function aircraftRenderPosition(p:{x:number;y:number;z:number},origin:GeoPoint) {
 const geo=worldToGeo(p),spherical=vector(ecefToLocal(toECEF(geo,p.y),origin));
 const airport=airportForPoint(p),dx=(p.x-airport.world.x)/(airport.runway.chartScale??1),dz=p.z-airport.world.z,d=Math.hypot(dx,dz);
 if(d>=4500)return spherical;
 const flat=vector(ecefToLocal(localToECEF({x:dx,y:p.y,z:dz},airport),origin));
 const blend=Math.max(0,Math.min(1,(d-2500)/2000));
 return flat.lerp(spherical,blend*blend*(3-2*blend));
}
export function visibleAirports(position:GeoPoint,radius=80000) {
 const p=toECEF(position);return airportList.filter(a=>{const q=toECEF(a);return Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)<radius;});
}
