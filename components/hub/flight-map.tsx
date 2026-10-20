'use client';
import { useState,useEffect,useRef,useMemo,useCallback } from 'react';
import { Plane,Plus,Minus,LocateFixed,MapPin } from 'lucide-react';
import { airportList, airports, type AirportId } from '@/lib/sim/airports';
import { greatCirclePoint, type PlannedWaypoint } from '@/lib/ui/flight-plan';
import type { GeoPoint } from '@/lib/world/geodesy';
const TILE=256;
function project(p:GeoPoint,zoom:number){const scale=TILE*2**zoom;return {x:(p.longitude+180)/360*scale,y:(1-Math.asinh(Math.tan(Math.max(-85,Math.min(85,p.latitude))*Math.PI/180))/Math.PI)/2*scale};}
function unproject(x:number,y:number,zoom:number):GeoPoint{const scale=TILE*2**zoom;return {longitude:((x/scale*360+180)%360+360)%360-180,latitude:Math.atan(Math.sinh(Math.PI*(1-2*y/scale)))*180/Math.PI};}
function nearestX(px:number,centerX:number,zoom:number){const w=TILE*2**zoom;return px+Math.round((centerX-px)/w)*w;}
export function FlightMap({from,to,waypoints,onAirport,onSelectAirport}:{from:AirportId;to:AirportId;waypoints:PlannedWaypoint[];onAirport:(id:AirportId)=>void;onSelectAirport:()=>void}){
 const wrap=useRef<HTMLDivElement>(null);const drag=useRef<{x:number;y:number;center:GeoPoint;dragged:boolean}|null>(null);
 const [size,setSize]=useState({w:850,h:600});const [center,setCenter]=useState<GeoPoint>({latitude:-23.52,longitude:-46.56});const [zoom,setZoom]=useState(8);
 useEffect(()=>{if(!wrap.current)return;const observer=new ResizeObserver(entries=>{const r=entries[0]?.contentRect;if(r)setSize({w:r.width,h:r.height});});observer.observe(wrap.current);return()=>observer.disconnect();},[]);
 const focus=useCallback(()=>{const a=airports[from],b=airports[to];const lonDelta=((((b.longitude-a.longitude)+540)%360)-180);const latitude=(a.latitude+b.latitude)/2;const longitude=(((a.longitude+lonDelta/2+180)%360)+360)%360-180;
 // Fit selected airport pair without showing the entire planet for short hops.
 const distance=Math.max(Math.abs(lonDelta),Math.abs(a.latitude-b.latitude));const fitting=Math.min(10,Math.max(2,Math.floor(Math.log2(Math.max(1,Math.min(size.w,size.h))/(256*Math.max(.003,distance)/120)))));
 setCenter({latitude,longitude});setZoom(fitting);},[from,to,size.w,size.h]);
 useEffect(()=>{focus();},[focus]);
 const origin=project(center,zoom);const topLeft={x:origin.x-size.w/2,y:origin.y-size.h/2};
 const tiles=useMemo(()=>{const list:{key:string;x:number;y:number;src:string}[]=[];const count=2**zoom;for(let y=Math.floor(topLeft.y/TILE)-1;y<=Math.ceil((topLeft.y+size.h)/TILE)+1;y++){if(y<0||y>=count)continue;for(let x=Math.floor(topLeft.x/TILE)-1;x<=Math.ceil((topLeft.x+size.w)/TILE)+1;x++){const tx=((x%count)+count)%count;list.push({key:`${x}/${y}`,x:x*TILE-topLeft.x,y:y*TILE-topLeft.y,src:`https://basemaps.cartocdn.com/light_all/${zoom}/${tx}/${y}.png`});}}return list;},[zoom,topLeft.x,topLeft.y,size.w,size.h]);
 const screenPoint=useCallback((p:GeoPoint)=>{const pixel=project(p,zoom);return {x:nearestX(pixel.x,origin.x,zoom)-topLeft.x,y:pixel.y-topLeft.y};},[zoom,origin.x,topLeft.x,topLeft.y]);
 const pathPoints=useMemo(()=>Array.from({length:65},(_,i)=>screenPoint(greatCirclePoint(airports[from],airports[to],i/64))),[from,to,screenPoint]);
 const line=pathPoints.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
 const zoomBy=(delta:number)=>setZoom(z=>Math.max(2,Math.min(11,z+delta)));
 return <div ref={wrap} className="jps-map" aria-label="Mapa interativo de aeroportos" onPointerDown={e=>{if(e.button!==0||(e.target as HTMLElement).closest('button'))return;drag.current={x:e.clientX,y:e.clientY,center,dragged:false};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>6)drag.current.dragged=true;const p=project(drag.current.center,zoom);setCenter(unproject(p.x-dx,p.y-dy,zoom));}} onPointerUp={e=>{if(drag.current?.dragged){e.preventDefault();}drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onWheel={e=>{if(e.ctrlKey)return;zoomBy(e.deltaY>0?-1:1);}}>
  <div className="jps-map-base" aria-hidden="true"/>
  <div className="jps-map-tiles" aria-hidden="true">{tiles.map(t=><img key={t.key} src={t.src} alt="" draggable={false} width={TILE} height={TILE} style={{left:t.x,top:t.y}}/>)}</div>
  <svg className="jps-map-overlay" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
   {from!==to&&<><path d={line} stroke="#001c3d" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" fill="none"/><path d={line} stroke="#168cf2" strokeWidth="1.3" fill="none" strokeDasharray="9 7"/>{waypoints.map(w=>{const p=screenPoint(w);return <g key={w.id}><circle cx={p.x} cy={p.y} r="4.2" fill="#fff" stroke="#07376b" strokeWidth="2.5"/><text x={p.x+9} y={p.y-9} fontSize="12" fill="#0b2443" fontWeight="750" stroke="#fff" strokeWidth="3" paintOrder="stroke">{w.id}</text></g>;})}</>}
  </svg>
  {airportList.map(ap=>{const p=screenPoint(ap);if(p.x < -65||p.x>size.w+65||p.y < -65||p.y>size.h+65)return null;return <button type="button" className={`jps-map-pin ${from===ap.id?'departure':''} ${to===ap.id?'arrival':''}`} style={{left:p.x,top:p.y}} key={ap.id} onClick={e=>{e.stopPropagation();if(drag.current?.dragged)return;onAirport(ap.id);}} title={`${ap.iata} · ${ap.name} (${ap.id})`} aria-label={`Selecionar aeroporto ${ap.iata} ${ap.name}`}><span className="pin-dot"/><span className="pin-code">{ap.iata}</span></button>;})}
  <div className="jps-map-tools"><button onClick={()=>zoomBy(1)} aria-label="Aproximar mapa"><Plus/></button><button onClick={()=>zoomBy(-1)} aria-label="Afastar mapa"><Minus/></button><button onClick={focus} aria-label="Enquadrar a rota"><LocateFixed/></button></div>
  <div className="jps-map-north">N<br/>▲</div><div className="jps-map-legend"><MapPin size={14}/> Toque em um aeroporto para selecioná-lo</div>
  <div className="jps-map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a> · <button onClick={onSelectAirport}>Lista de aeroportos</button></div>
 </div>;
}
