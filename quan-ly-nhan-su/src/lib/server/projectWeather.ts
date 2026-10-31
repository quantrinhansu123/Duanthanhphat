import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { qualityDate, qualityUuid } from "@/lib/server/weldQualityJournal";
import { reportWeatherFields } from "@/lib/reportWeather";

export async function loadProjectWeather(body: Record<string, unknown>) {
  const projectId = qualityUuid(body.du_an_id);
  const date = qualityDate(body.date);
  if (!date) throw new Error("Chọn ngày để tự điền thời tiết.");
  const { data, error } = await createAdminClient().from("toa_do")
    .select("vi_do,kinh_do").eq("du_an_id", projectId)
    .not("vi_do", "is", null).not("kinh_do", "is", null).order("id").limit(1);
  if (error) throw error;
  let lat = Number(data?.[0]?.vi_do), lon = Number(data?.[0]?.kinh_do);
  if (!data?.length) {
    const project = await createAdminClient().from("du_an").select("vi_tri").eq("id", projectId).single();
    if (project.error) throw project.error;
    const location = project.data.vi_tri?.trim() ?? "";
    if (/ph[uú]\s*qu[oố]c/i.test(location)) {
      lat = 10.2; lon = 103.96;
    } else if (location) {
      const search = new URL("https://geocoding-api.open-meteo.com/v1/search");
      search.search = new URLSearchParams({ name: location.split(/\s+[-–]\s+|,/)[0], count: "1", language: "vi" }).toString();
      const response = await fetch(search, { signal: AbortSignal.timeout(10000), next: { revalidate: 86400 } });
      if (!response.ok) throw new Error("Chưa xác định được địa điểm dự án để lấy thời tiết. Có thể nhập tay.");
      const match = (await response.json()).results?.[0];
      lat = match?.latitude; lon = match?.longitude;
    }
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error("Dự án chưa có tọa độ hợp lệ để lấy thời tiết. Có thể nhập tay.");
  }
  const old = Date.parse(date) < Date.now() - 90 * 86400000;
  const url = new URL(old ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({ latitude: String(lat), longitude: String(lon), timezone: "auto",
    start_date: date, end_date: date, daily: "weather_code,temperature_2m_mean", hourly: "weather_code,temperature_2m" }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), next: { revalidate: 1800 } });
  if (!response.ok) throw new Error("Chưa lấy được thời tiết tự động cho ngày đã chọn. Có thể nhập tay.");
  return reportWeatherFields(await response.json(), date);
}
