/** Weather from Open-Meteo (no API key). Cached by Next for 30 minutes. */
export interface DayForecast { date: string; code: number; tmax: number; tmin: number; rain: number; wind: number }
export interface Weather { place: string; lat: number; lng: number; current: { temp: number; code: number; wind: number; feels: number }; days: DayForecast[] }

export async function geocode(place: string): Promise<{ lat: number; lng: number; name: string } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`;
  try {
    const r = await fetch(url, { next: { revalidate: 86400 } });
    if (!r.ok) return null;
    const j = await r.json();
    const hit = j.results?.[0];
    return hit ? { lat: hit.latitude, lng: hit.longitude, name: `${hit.name}, ${hit.admin1 ?? ""}`.replace(/, $/, "") } : null;
  } catch {
    return null;
  }
}

export async function getWeather(lat: number, lng: number, place: string): Promise<Weather | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&forecast_days=6`;
  try {
    const r = await fetch(url, { next: { revalidate: 1800 } });
    if (!r.ok) return null;
    const j = await r.json();
    const days: DayForecast[] = (j.daily?.time ?? []).map((d: string, i: number) => ({
      date: d,
      code: j.daily.weather_code[i],
      tmax: Math.round(j.daily.temperature_2m_max[i]),
      tmin: Math.round(j.daily.temperature_2m_min[i]),
      rain: j.daily.precipitation_probability_max?.[i] ?? 0,
      wind: Math.round(j.daily.wind_speed_10m_max?.[i] ?? 0),
    }));
    return {
      place, lat, lng,
      current: { temp: Math.round(j.current.temperature_2m), feels: Math.round(j.current.apparent_temperature), code: j.current.weather_code, wind: Math.round(j.current.wind_speed_10m) },
      days,
    };
  } catch {
    return null;
  }
}

/** Weather for a territory: stored centre, else the first city, else Atlanta. */
export async function weatherForPlace(place: string | null | undefined, lat?: number | null, lng?: number | null) {
  if (lat != null && lng != null) return getWeather(Number(lat), Number(lng), place || "Territory");
  const g = await geocode(`${place || "Atlanta"}, Georgia`);
  if (!g) return null;
  return getWeather(g.lat, g.lng, g.name);
}

export function wmo(code: number): { label: string; emoji: string; severe: boolean } {
  if (code === 0) return { label: "Clear", emoji: "☀️", severe: false };
  if (code <= 2) return { label: "Partly cloudy", emoji: "🌤️", severe: false };
  if (code === 3) return { label: "Overcast", emoji: "☁️", severe: false };
  if (code <= 48) return { label: "Fog", emoji: "🌫️", severe: false };
  if (code <= 57) return { label: "Drizzle", emoji: "🌦️", severe: false };
  if (code <= 67) return { label: "Rain", emoji: "🌧️", severe: code >= 65 };
  if (code <= 77) return { label: "Snow", emoji: "🌨️", severe: true };
  if (code <= 82) return { label: "Showers", emoji: "🌧️", severe: code >= 82 };
  if (code <= 86) return { label: "Snow showers", emoji: "🌨️", severe: true };
  return { label: "Thunderstorm", emoji: "⛈️", severe: true };
}
