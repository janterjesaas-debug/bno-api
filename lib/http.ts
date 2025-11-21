// lib/http.ts
import axios from 'axios';

export async function postJson<T>(url: string, body: any) {
  const res = await axios.post<T>(url, body, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.data;
}
