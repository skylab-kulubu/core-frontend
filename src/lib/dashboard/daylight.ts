// Istanbul, where the club meets; close enough for every member's sky
const LATITUDE = 41.0082;
const LONGITUDE = 28.9784;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Sunrise and sunset on the given day, after NOAA's general solar position
 * equations (accurate to a minute or two, which a greeting does not notice).
 */
export function sunTimes(
  day: Date,
  latitude = LATITUDE,
  longitude = LONGITUDE,
): { sunrise: Date; sunset: Date } {
  const start = Date.UTC(day.getUTCFullYear(), 0, 1);
  const noon = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12);
  const dayOfYear = Math.floor((noon - start) / 86_400_000) + 1;
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const lat = rad(latitude);
  const hourAngle = deg(
    Math.acos(
      Math.cos(rad(90.833)) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl),
    ),
  );
  const midnight = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  const minutes = (value: number) => new Date(midnight + value * 60_000);
  return {
    sunrise: minutes(720 - 4 * (longitude + hourAngle) - eqTime),
    sunset: minutes(720 - 4 * (longitude - hourAngle) - eqTime),
  };
}

/** Minutes since midnight on Istanbul's clock (UTC+3 all year since 2016). */
function istanbulMinutes(now: Date): number {
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + 180) % 1440;
}

/** The greeting for a moment, by the sun over Istanbul rather than a fixed clock. */
export function greetingFor(now: Date): string {
  const { sunrise, sunset } = sunTimes(now);
  const t = now.getTime();
  const minutes = istanbulMinutes(now);
  // Late morning and late evening are clock times; sunrise and sunset move with the seasons
  const beforeLateMorning = minutes < 11 * 60;
  const beforeLateEvening = minutes < 22 * 60 + 30;
  if (t >= sunrise.getTime() - 3_600_000 && beforeLateMorning) return 'Günaydın';
  if (!beforeLateMorning && t < sunset.getTime()) return 'İyi günler';
  if (t >= sunset.getTime() && beforeLateEvening) return 'İyi akşamlar';
  return 'İyi geceler';
}
