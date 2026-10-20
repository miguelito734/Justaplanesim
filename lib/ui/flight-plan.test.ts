import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { aircraft } from '../sim/aircraft';
import { flightDistanceKm,estimatedMinutes,generateGpsWaypoints,greatCirclePoint } from './flight-plan';
test('flight planner uses actual airport geodesy and honest GPS points',()=>{
 assert.ok(flightDistanceKm('SBGR','SBSP')>20);
 assert.equal(generateGpsWaypoints('SBGR','SBGR').length,0);
 const route=generateGpsWaypoints('SBGR','FACT');assert.ok(route.length>=1);
 for(const fix of route){assert.ok(Number.isFinite(fix.latitude)&&Number.isFinite(fix.longitude));assert.match(fix.id,/^GPS\d\d$/);}
 const a=greatCirclePoint({latitude:0,longitude:179},{latitude:0,longitude:-179},.5);
 assert.ok(Math.abs(Math.abs(a.longitude)-180)<.001);
});
test('flight planning modes respect 30-minute fast threshold',()=>{
 const jet=aircraft.find(a=>a.id==='e195')!;
 assert.equal(estimatedMinutes('SBGR','SBSP',jet,'rapido'),5);
 assert.equal(estimatedMinutes('SBGR','FACT',jet,'rapido'),15);
 assert.ok(estimatedMinutes('SBGR','FACT',jet,'normal')<estimatedMinutes('SBGR','FACT',jet,'realista'));
});
