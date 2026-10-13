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
