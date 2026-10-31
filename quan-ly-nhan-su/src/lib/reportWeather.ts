export type ReportWeather = {
  thoiTiet: string;
  nhietDo: string;
  sang: string;
  chieu: string;
  toi: string;
};

export function weatherLabel(code: number): string {
  if (code <= 1) return "Nắng";
  if (code <= 3) return "Nhiều mây";
  if (code === 45 || code === 48) return "Sương mù";
  if (code >= 95) return "Dông";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Tuyết";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "Mưa";
  return "Bình thường";
}

export function reportWeatherFields(data: {
  daily?: { time?: string[]; weather_code?: (number | null)[]; temperature_2m_mean?: (number | null)[] };
  hourly?: { time?: string[]; weather_code?: (number | null)[]; temperature_2m?: (number | null)[] };
}, date: string): ReportWeather {
  const i = data.daily?.time?.indexOf(date) ?? -1;
  const code = data.daily?.weather_code?.[i];
  const temp = data.daily?.temperature_2m_mean?.[i];
  if (code == null || temp == null || !Number.isFinite(code) || !Number.isFinite(temp)) {
    throw new Error("Chưa có dữ liệu thời tiết cho ngày đã chọn. Có thể nhập tay.");
  }
  const at = (hour: string) => {
    const index = data.hourly?.time?.indexOf(`${date}T${hour}:00`) ?? -1;
    const c = data.hourly?.weather_code?.[index];
    const t = data.hourly?.temperature_2m?.[index];
    return c == null || t == null ? "" : `${hour === "19" && c <= 1 ? "Trời quang" : weatherLabel(c)}, ${Math.round(t)}°C`;
  };
  return { thoiTiet: weatherLabel(code), nhietDo: String(Math.round(temp)), sang: at("07"), chieu: at("13"), toi: at("19") };
}
