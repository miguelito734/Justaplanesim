'use client';
import { useState,useEffect,useRef,useMemo,useCallback } from 'react';
import { Plus,Minus,LocateFixed,MapPin } from 'lucide-react';
import { airportList, airports, type AirportId } from '@/lib/sim/airports';
import { greatCirclePoint, type PlannedWaypoint } from '@/lib/ui/flight-plan';
import type { GeoPoint } from '@/lib/world/geodesy';
const TILE=256;
function project(p:GeoPoint,zoom:number){const scale=TILE*2**zoom;return {x:(p.longitude+180)/360*scale,y:(1-Math.asinh(Math.tan(Math.max(-85,Math.min(85,p.latitude))*Math.PI/180))/Math.PI)/2*scale};}
function unproject(x:number,y:number,zoom:number):GeoPoint{const scale=TILE*2**zoom;return {longitude:((x/scale*360+180)%360+360)%360-180,latitude:Math.atan(Math.sinh(Math.PI*(1-2*y/scale)))*180/Math.PI};}
function nearestX(px:number,centerX:number,zoom:number){const w=TILE*2**zoom;return px+Math.round((centerX-px)/w)*w;}
export function FlightMap({from,to,waypoints,onAirport,onSelectAirport}:{from:AirportId;to:AirportId;waypoints:PlannedWaypoint[];onAirport:(id:AirportId)=>void;onSelectAirport:()=>void}){
 const wrap=useRef<HTMLDivElement>(null);
 const fingers=useRef(new Map<number,{x:number;y:number}>());
 const gesture=useRef<null|{startCenter:GeoPoint;startZoom:number;startX:number;startY:number;distance:number;anchor:GeoPoint;pinching:boolean;dragged:boolean}>(null);
 const [size,setSize]=useState({w:850,h:600});const [center,setCenter]=useState<GeoPoint>({latitude:-23.52,longitude:-46.56});const [zoom,setZoom]=useState(8);
 useEffect(()=>{if(!wrap.current)return;const observer=new ResizeObserver(entries=>{const r=entries[0]?.contentRect;if(r)setSize({w:r.width,h:r.height});});observer.observe(wrap.current);return()=>observer.disconnect();},[]);
 const focus=useCallback(()=>{const a=airports[from],b=airports[to];const lonDelta=((((b.longitude-a.longitude)+540)%360)-180);const latitude=(a.latitude+b.latitude)/2;const longitude=(((a.longitude+lonDelta/2+180)%360)+360)%360-180;
 // Fit selected airport pair without showing the entire planet for short hops.
 const distance=Math.max(Math.abs(lonDelta),Math.abs(a.latitude-b.latitude));const fitting=Math.min(10,Math.max(2,Math.floor(Math.log2(Math.max(1,Math.min(size.w,size.h))/(256*Math.max(.003,distance)/120)))));
 setCenter({latitude,longitude});setZoom(fitting);},[from,to,size.w,size.h]);
 useEffect(()=>{focus();},[focus]);
 const origin=project(center,zoom);const topLeft={x:origin.x-size.w/2,y:origin.y-size.h/2};
 // Use integer OSM tile levels, while scaling tile positions for smooth fractional zoom.
 const tiles=useMemo(()=>{const list:{key:string;x:number;y:number;src:string;tileSize:number}[]=[];const tileZoom=Math.floor(zoom);const tileSize=TILE*2**(zoom-tileZoom);const count=2**tileZoom;
 for(let y=Math.floor(topLeft.y/tileSize)-1;y<=Math.ceil((topLeft.y+size.h)/tileSize)+1;y++){if(y<0||y>=count)continue;
  for(let x=Math.floor(topLeft.x/tileSize)-1;x<=Math.ceil((topLeft.x+size.w)/tileSize)+1;x++){
   const tx=((x%count)+count)%count;
   list.push({key:`${x}/${y}`,x:x*tileSize-topLeft.x,y:y*tileSize-topLeft.y,tileSize,src:`https://tile.openstreetmap.org/${tileZoom}/${tx}/${y}.png`});
  }
 }return list;},[zoom,topLeft.x,topLeft.y,size.w,size.h]);
 const screenPoint=useCallback((p:GeoPoint)=>{const pixel=project(p,zoom);return {x:nearestX(pixel.x,origin.x,zoom)-topLeft.x,y:pixel.y-topLeft.y};},[zoom,origin.x,topLeft.x,topLeft.y]);
 const pathPoints=useMemo(()=>Array.from({length:65},(_,i)=>screenPoint(greatCirclePoint(airports[from],airports[to],i/64))),[from,to,screenPoint]);
 const line=pathPoints.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
 // Anchor zoom to the cursor/touch midpoint, instead of jumping back to the map centre.
 const anchoredView=(anchor:GeoPoint,clientX:number,clientY:number,nextZoom:number)=>{
  const bounds=wrap.current?.getBoundingClientRect();if(!bounds)return;
  const pixel=project(anchor,nextZoom);
  setCenter(unproject(pixel.x-(clientX-bounds.left-bounds.width/2),pixel.y-(clientY-bounds.top-bounds.height/2),nextZoom));
  setZoom(nextZoom);
 };
 const zoomBy=(delta:number,clientX?:number,clientY?:number)=>{
  const r=wrap.current?.getBoundingClientRect();if(!r)return;
  const x=clientX??r.left+r.width/2,y=clientY??r.top+r.height/2;
  const anchor=unproject(origin.x+x-r.left-r.width/2,origin.y+y-r.top-r.height/2,zoom);
  anchoredView(anchor,x,y,Math.max(2,Math.min(11,zoom+delta)));
 };
 const beginGesture=()=>{
  const points=[...fingers.current.values()];if(!points.length){gesture.current=null;return;}
  const r=wrap.current?.getBoundingClientRect();if(!r)return;
  const x=points.reduce((a,p)=>a+p.x,0)/points.length;
  const y=points.reduce((a,p)=>a+p.y,0)/points.length;
  const distance=points.length>1?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y):1;
  gesture.current={startCenter:center,startZoom:zoom,startX:x,startY:y,distance,anchor:unproject(origin.x+x-r.left-r.width/2,origin.y+y-r.top-r.height/2,zoom),pinching:points.length>1,dragged:false};
 };
 const moveGesture=()=>{
  const g=gesture.current;if(!g)return;
  const points=[...fingers.current.values()];if(!points.length)return;
  const x=points.reduce((a,p)=>a+p.x,0)/points.length;
  const y=points.reduce((a,p)=>a+p.y,0)/points.length;
  if(g.pinching&&points.length>1){
   const distance=Math.max(1,Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y));
   const nextZoom=Math.max(2,Math.min(11,g.startZoom+Math.log2(distance/g.distance)));
   anchoredView(g.anchor,x,y,nextZoom);
  }else if(!g.pinching){
   if(Math.abs(x-g.startX)+Math.abs(y-g.startY)>6)g.dragged=true;
   const p=project(g.startCenter,g.startZoom);
   setCenter(unproject(p.x-(x-g.startX),p.y-(y-g.startY),g.startZoom));
  }
 };
 return <div ref={wrap} className="jps-map" aria-label="Mapa interativo de aeroportos"
  onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;if((e.target as HTMLElement).closest('button, a'))return;
   fingers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});e.currentTarget.setPointerCapture(e.pointerId);beginGesture();}}
  onPointerMove={e=>{if(!fingers.current.has(e.pointerId))return;fingers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});moveGesture();}}
  onPointerUp={e=>{fingers.current.delete(e.pointerId);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);beginGesture();}}
  onPointerCancel={e=>{fingers.current.delete(e.pointerId);beginGesture();}}
  onWheel={e=>{if(e.ctrlKey)return;zoomBy(e.deltaY>0?-.25:.25,e.clientX,e.clientY);}}>
  <div className="jps-map-base" aria-hidden="true"/>
  <div className="jps-map-tiles" aria-hidden="true">{tiles.map(t=><img key={t.key} src={t.src} alt="" draggable={false} width={TILE} height={TILE} style={{left:t.x,top:t.y,width:t.tileSize,height:t.tileSize}}/>)}</div>
  <svg className="jps-map-overlay" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
   {from!==to&&<><path d={line} stroke="#001c3d" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" fill="none"/><path d={line} stroke="#168cf2" strokeWidth="1.3" fill="none" strokeDasharray="9 7"/>{waypoints.map(w=>{const p=screenPoint(w);return <g key={w.id}><circle cx={p.x} cy={p.y} r="4.2" fill="#fff" stroke="#07376b" strokeWidth="2.5"/><text x={p.x+9} y={p.y-9} fontSize="12" fill="#0b2443" fontWeight="750" stroke="#fff" strokeWidth="3" paintOrder="stroke">{w.id}</text></g>;})}</>}
  </svg>
  {airportList.map(ap=>{const p=screenPoint(ap);if(p.x < -65||p.x>size.w+65||p.y < -65||p.y>size.h+65)return null;return <button type="button" className={`jps-map-pin ${from===ap.id?'departure':''} ${to===ap.id?'arrival':''}`} style={{left:p.x,top:p.y}} key={ap.id} onClick={e=>{e.stopPropagation();onAirport(ap.id);}} title={`${ap.iata} · ${ap.name} (${ap.id})`} aria-label={`Selecionar aeroporto ${ap.iata} ${ap.name}`}><span className="pin-dot"/><span className="pin-code">{ap.iata}</span></button>;})}
  <div className="jps-map-tools"><button onClick={()=>zoomBy(1)} aria-label="Aproximar mapa"><Plus/></button><button onClick={()=>zoomBy(-1)} aria-label="Afastar mapa"><Minus/></button><button onClick={focus} aria-label="Enquadrar a rota"><LocateFixed/></button></div>
  <div className="jps-map-north">N<br/>▲</div><div className="jps-map-legend"><MapPin size={14}/> Toque em um aeroporto para selecioná-lo</div>
  <div className="jps-map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · <button onClick={onSelectAirport}>Lista de aeroportos</button></div>
 </div>;
}
