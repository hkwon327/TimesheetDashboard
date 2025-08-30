import axios from "axios";

const BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
});

if (typeof window !== "undefined") {
  // 디버깅용
  console.log("[API BASE]", BASE);
}
