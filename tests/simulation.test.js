import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { dateAtOffset, getSunPosition, formatTime, solarPhase, solarEvents, earthSunDirection } from '../src/lib/sun.js';
import { placeModel } from '../src/lib/model.js';

test('Shanghai clock maps to UTC independently of browser timezone', () => {
  assert.equal(dateAtOffset('2026-10-13', 840, 8).toISOString(), '2026-10-13T06:00:00.000Z');
  assert.equal(dateAtOffset('2026-01-01', 0, 8).toISOString(), '2025-12-31T16:00:00.000Z');
  assert.equal(dateAtOffset('2026-10-13', 840, 5.5).toISOString(), '2026-10-13T08:30:00.000Z');
  assert.equal(formatTime(1439), '23:59');
});

test('sun is above the horizon at Shanghai midday and below it at midnight', () => {
  const day = getSunPosition(dateAtOffset('2026-10-13', 720, 8), 31.2304, 121.4737);
  const night = getSunPosition(dateAtOffset('2026-10-13', 0, 8), 31.2304, 121.4737);
  assert.ok(day.altitude > 0);
  assert.ok(night.altitude < 0);
  assert.ok(day.bearing >= 0 && day.bearing < 360);
  assert.ok(Math.abs(Math.hypot(day.x, day.y, day.z) - 50) < 1e-9);
});

test('normalization centers an offset model and puts its lowest point on the ground', () => {
  const model = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 6));
  mesh.position.set(20, -8, 30);
  model.add(mesh);
  placeModel(model);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(center.x) < 1e-8);
  assert.ok(Math.abs(center.z) < 1e-8);
  assert.ok(Math.abs(box.min.y) < 1e-8);
  assert.ok(Math.abs(box.getSize(new THREE.Vector3()).z - 12) < 1e-8);
});

test('all RB21 binary and texture references exist for deployment', () => {
  const directory = 'public/f1-2025_redbull_rb21';
  const gltf = JSON.parse(fs.readFileSync(`${directory}/scene.gltf`, 'utf8'));
  for (const item of [...gltf.buffers, ...gltf.images]) {
    if (item.uri && !item.uri.startsWith('data:')) assert.ok(fs.existsSync(path.join(directory, decodeURIComponent(item.uri))), item.uri);
  }
});

test('twilight thresholds follow solar-centre standard definitions', () => {
  assert.equal(solarPhase(-.833).key, 'day');
  assert.equal(solarPhase(-.834).key, 'civil');
  assert.equal(solarPhase(-6).key, 'civil');
  assert.equal(solarPhase(-6.01).key, 'nautical');
  assert.equal(solarPhase(-12).key, 'nautical');
  assert.equal(solarPhase(-12.01).key, 'astronomical');
  assert.equal(solarPhase(-18).key, 'astronomical');
  assert.equal(solarPhase(-18.01).key, 'night');
});

test('Earth diagram uses the same local sunlight altitude as the car scene', () => {
  for (const [lat,lon] of [[31.2304,121.4737],[1.3521,103.8198],[-33.87,151.21],[89,0]]) {
    for (const minute of [0,360,720,1080]) {
      const sun = getSunPosition(dateAtOffset('2026-10-13',minute,8),lat,lon);
      const {up,direction} = earthSunDirection(sun,lat,lon);
      assert.ok(Math.abs(Math.hypot(...direction)-1) < 1e-9);
      assert.ok(Math.abs(up.reduce((dot,value,i)=>dot+value*direction[i],0)-Math.sin(sun.altitude)) < 1e-9);
    }
  }
});

test('polar events display missing crossings without invalid times', () => {
  const polar = solarEvents('2026-06-21',89,0,0);
  assert.equal(polar.find(row=>row[0]==='日出')[1],'—');
  assert.equal(polar.find(row=>row[0]==='日落')[1],'—');
  assert.ok(!JSON.stringify(polar).includes('NaN'));
  const shanghai = solarEvents('2026-10-13',31.2304,121.4737,8);
  assert.ok(shanghai.every(row=>/^\d{2}:\d{2}$/.test(row[1])));
});
