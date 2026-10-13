import SunCalc from 'suncalc';

export function dateAtOffset(dateStr, minutes, utcOffset) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, minutes) - utcOffset * 3600000);
}

export function getSunPosition(date, lat, lon, radius = 50) {
  const { altitude, azimuth } = SunCalc.getPosition(date, lat, lon);
  const horizontal = Math.cos(altitude) * radius;
  return {
    x: -horizontal * Math.sin(azimuth),
    y: Math.sin(altitude) * radius,
    z: horizontal * Math.cos(azimuth),
    altitude,
    bearing: ((azimuth * 180 / Math.PI) + 180 + 360) % 360,
  };
}

export function formatTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

// Standard geometric solar-centre thresholds; sunrise includes refraction and solar radius.
export function solarPhase(altitudeDegrees) {
  if (altitudeDegrees >= -0.833) return { key: 'day', label: '日间', description: '日出与日落之间' };
  if (altitudeDegrees >= -6) return { key: 'civil', label: '民用曙暮光', description: '太阳在地平线下，仍有明亮天光' };
  if (altitudeDegrees >= -12) return { key: 'nautical', label: '航海曙暮光', description: '天空渐暗，地平线逐渐隐没' };
  if (altitudeDegrees >= -18) return { key: 'astronomical', label: '天文曙暮光', description: '日光散射接近消退' };
  return { key: 'night', label: '天文夜', description: '太阳低于 −18°' };
}

export function solarEvents(dateStr, lat, lon, utcOffset) {
  const times = SunCalc.getTimes(dateAtOffset(dateStr, 720, utcOffset), lat, lon);
  const local = value => {
    if (!Number.isFinite(value?.getTime())) return '—';
    const shifted = new Date(value.getTime() + utcOffset * 3600000);
    const label = formatTime(shifted.getUTCHours() * 60 + shifted.getUTCMinutes());
    const dayOffset = Math.round((Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - Date.parse(`${dateStr}T00:00:00Z`)) / 86400000);
    return label + (dayOffset ? `（${dayOffset > 0 ? '+' : ''}${dayOffset}日）` : '');
  };
  return [
    ['天文曙光', local(times.nightEnd), '−18°'],
    ['航海曙光', local(times.nauticalDawn), '−12°'],
    ['民用曙光', local(times.dawn), '−6°'],
    ['日出', local(times.sunrise), '−0.833°'],
    ['太阳正午', local(times.solarNoon), '最高点'],
    ['日落', local(times.sunset), '−0.833°'],
    ['民用暮光结束', local(times.dusk), '−6°'],
    ['航海暮光结束', local(times.nauticalDusk), '−12°'],
    ['天文暮光结束', local(times.night), '−18°'],
  ];
}

// Earth-fixed axes: Y=north pole; X=equator/Greenwich; Z=equator/90°E.
export function earthSunDirection(sun, lat, lon) {
  const phi = lat * Math.PI / 180;
  const lambda = lon * Math.PI / 180;
  const up = [Math.cos(phi) * Math.cos(lambda), Math.sin(phi), Math.cos(phi) * Math.sin(lambda)];
  const east = [-Math.sin(lambda), 0, Math.cos(lambda)];
  const north = [-Math.sin(phi) * Math.cos(lambda), Math.cos(phi), -Math.sin(phi) * Math.sin(lambda)];
  const radius = Math.hypot(sun.x, sun.y, sun.z);
  return { up, direction: up.map((v, i) => (sun.x * east[i] + sun.y * v - sun.z * north[i]) / radius) };
}
