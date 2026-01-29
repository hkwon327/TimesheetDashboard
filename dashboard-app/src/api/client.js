import axios from "axios";

// CRA는 REACT_APP_* 만 주입됩니다.
const BASE = process.env.REACT_APP_API_BASE_URL;

export const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
});

const BAD_ORIGINS = [
  /^http:\/\/\d{1,3}(\.\d{1,3}){3}:8000/i, // http://<IP>:8000
  /^http:\/\/localhost:8000/i,
];
api.interceptors.request.use((config) => {
  const u = config.url || "";
  if (BAD_ORIGINS.some((re) => re.test(u))) {
    // 호스트 제거 → 상대 경로로 바꿔 BASE에 붙이기
    config.url = u.replace(/^https?:\/\/[^/]+/i, "");
    config.baseURL = BASE;
  }
  return config;
});

if (typeof window !== "undefined") {
  console.log("[API BASE]", BASE);
}
