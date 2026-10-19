import { EARTH_RADIUS, toECEF, fromECEF, type GeoPoint, type Vec3 } from './geodesy';
import { elevation } from './elevation';
import landRows from './land-mask.json';
export type Tile = { face:number; level:number; x:number; y:number; key:string };
export const SEGMENTS=16;
export const tile=(face:number,level:number,x:number,y:number):Tile=>({face,level,x,y,key:`${face}/${level}/${x}/${y}`});
/** Adjacent cube faces evaluate the SAME sphere, including poles and dateline. */
export function cubePoint(face:number,u:number,v:number):Vec3 {
 const p=face===0?{x:1,y:v,z:-u}:face===1?{x:-1,y:v,z:u}:face===2?{x:u,y:1,z:-v}:face===3?{x:u,y:-1,z:v}:face===4?{x:u,y:v,z:1}:{x:-u,y:v,z:-1};
 const n=Math.hypot(p.x,p.y,p.z);return {x:p.x/n,y:p.y/n,z:p.z/n};
}
export function tilePoint(t:Tile,i:number,j:number,n=SEGMENTS) {
 const scale=2/2**t.level;
 return cubePoint(t.face,-1+(t.x+i/n)*scale,-1+(t.y+j/n)*scale);
}
export function isLand(p:GeoPoint) {
 const row=landRows[Math.min(359,Math.max(0,Math.floor((90-p.latitude)*2)))];
 const x=((p.longitude+180)%360+360)%360*2;
 for(let i=0;i<row.length;i+=2)if(x>=row[i]&&x<row[i+1])return true;
 return false;
}
export function tileAt(point:GeoPoint,level:number):Tile {
 const p=toECEF(point),ax=Math.abs(p.x),ay=Math.abs(p.y),az=Math.abs(p.z);let face:number,u:number,v:number;
 if(ax>=ay&&ax>=az){face=p.x>=0?0:1;u=(p.x>=0?-p.z:p.z)/ax;v=p.y/ax;}
 else if(ay>=az){face=p.y>=0?2:3;u=p.x/ay;v=(p.y>=0?-p.z:p.z)/ay;}
 else {face=p.z>=0?4:5;u=(p.z>=0?p.x:-p.x)/az;v=p.y/az;}
 const n=2**level;return tile(face,level,Math.min(n-1,Math.max(0,Math.floor((u+1)*n/2))),Math.min(n-1,Math.max(0,Math.floor((v+1)*n/2))));
}
function children(t:Tile) {return [tile(t.face,t.level+1,t.x*2,t.y*2),tile(t.face,t.level+1,t.x*2+1,t.y*2),tile(t.face,t.level+1,t.x*2,t.y*2+1),tile(t.face,t.level+1,t.x*2+1,t.y*2+1)];}
/** Complete leaf partition, never partial children. Bounded independent of flight duration. */
export function selectTiles(position:GeoPoint,altitude:number,budget=126,predicted=position):Tile[] {
 const view=toECEF(position),ahead=toECEF(predicted);
 const leaves=Array.from({length:6},(_,f)=>tile(f,0,0,0));
 const score=(t:Tile)=>{
  if(t.level>=12)return 0;
  const c=tilePoint(t,8,8),size=EARTH_RADIUS*2/2**t.level;
  const distance=(p:Vec3)=>Math.max(0,Math.hypot(c.x*EARTH_RADIUS-p.x,c.y*EARTH_RADIUS-p.y,c.z*EARTH_RADIUS-p.z)-size*.72);
  if(size>Math.max(1600,altitude*.8)&&(tileAt(position,t.level).key===t.key||tileAt(predicted,t.level).key===t.key))return 1e9+t.level;
  return size/Math.max(1600,Math.max(0,altitude)*.8,Math.min(distance(view),distance(ahead))*.65);
 };
 while(leaves.length+3<=budget){let best=-1,priority=1;for(let i=0;i<leaves.length;i++){const s=score(leaves[i]);if(s>priority){best=i;priority=s;}}
  if(best<0)break;leaves.splice(best,1,...children(leaves[best]));}
 return leaves;
}
export type TileData={positions:Float32Array;normals:Float32Array;colors:Float32Array;indices:Uint16Array;center:Vec3;bytes:number};
export function buildTile(t:Tile):TileData {
 const n=SEGMENTS,side=n+1,edgeCount=n*4,count=side*side+edgeCount;
 const positions=new Float32Array(count*3),normals=new Float32Array(count*3),colors=new Float32Array(count*3);
 const c=tilePoint(t,n/2,n/2),center={x:c.x*EARTH_RADIUS,y:c.y*EARTH_RADIUS,z:c.z*EARTH_RADIUS};
 const indices:number[]=[];
 const put=(index:number,unit:Vec3,depth=0)=>{const geo=fromECEF(unit),r=EARTH_RADIUS+elevation.sampleMeters(geo)-depth,k=index*3;
  positions.set([unit.x*r-center.x,unit.y*r-center.y,unit.z*r-center.z],k);normals.set([unit.x,unit.y,unit.z],k);
  colors.set(isLand(geo)?[.24,.39,.22]:[.08,.27,.39],k);};
 for(let j=0;j<=n;j++)for(let i=0;i<=n;i++)put(j*side+i,tilePoint(t,i,j));
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*side+i,b=a+1,c=a+side,d=c+1;indices.push(a,b,c,b,d,c);}
 // Skirts occlude T-junctions between LODs. They are visual only, never collision walls.
 const edge:number[]=[];for(let i=0;i<n;i++)edge.push(i);for(let j=0;j<n;j++)edge.push(j*side+n);for(let i=n;i>0;i--)edge.push(n*side+i);for(let j=n;j>0;j--)edge.push(j*side);
 const cell=EARTH_RADIUS*2/2**t.level/n,depth=Math.max(2,cell*cell/EARTH_RADIUS*2);
 edge.forEach((a,i)=>{const b=edge[(i+1)%edge.length],s=side*side+i,q=side*side+(i+1)%edge.length;put(s,tilePoint(t,a%side,Math.floor(a/side)),depth);indices.push(a,s,b,b,s,q);});
 const indexArray=new Uint16Array(indices);
 return {positions,normals,colors,indices:indexArray,center,bytes:positions.byteLength+normals.byteLength+colors.byteLength+indexArray.byteLength};
}
/** Two-generation cache: previous complete coverage stays live until replacement is ready. */
export class TerrainStream {
 readonly cache=new Map<string,TileData>(); active:Tile[]=[]; private pending:Tile[]=[]; private queue:Tile[]=[];
 builds=0; lastBuildMs=0; generation=0;
 constructor(readonly budget=126){}
 request(tiles:Tile[]) {
  if(this.queue.length)return; // finish bounded generation; do not starve under continuous motion
  this.pending=tiles.slice(0,this.budget);this.queue=this.pending.filter(t=>!this.cache.has(t.key));
  if(!this.queue.length)this.commit();
 }
 pump(maxTiles=1) {
  const start=performance.now();let changed=false;
  for(let i=0;i<maxTiles&&this.queue.length;i++){const t=this.queue.shift()!;if(!this.cache.has(t.key)){this.cache.set(t.key,buildTile(t));this.builds++;}}
  this.lastBuildMs=performance.now()-start;
  if(this.pending.length&&!this.queue.length){this.commit();changed=true;}return changed;
 }
 private commit(){this.active=this.pending;this.pending=[];this.generation++;
  const keep=new Set(this.active.map(t=>t.key));for(const key of this.cache.keys())if(!keep.has(key))this.cache.delete(key);}
 get queued(){return this.queue.length;}
 get bytes(){let n=0;for(const v of this.cache.values())n+=v.bytes;return n;}
 clear(){this.active=[];this.pending=[];this.queue=[];this.cache.clear();}
}
