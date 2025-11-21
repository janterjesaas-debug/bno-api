// app/lib/api.ts
/* Enkel API-klient for bno-api */
export const API_BASE =
  (process.env.EXPO_PUBLIC_API_BASE?.replace(/\/$/, '') ||
    'http://192.168.86.232:4000/api'); // <-- bytt til din IP eller bruk tunnel

export type Product = {
  Id: string;
  Name?: string;
  Description?: string;
  Image?: string | null;
  Currency?: string;
  PriceGross?: number;
};

export type PreviewData = {
  room: {
    roomCategoryId: string;
    rateId?: string;
    nights: number;
    priceNightly: number[];
    priceTotal: number;
    currency: string;
  };
  products: any[];
  productsTotal: number;
  grandTotal: number;
};

type CreateBody = {
  startYmd: string;
  endYmd: string;
  roomCategoryId: string;
  rateId?: string;
  adults: number;
  currency: string;
  openStage?: 'rates' | 'summary';
  products: Array<{ productId: string; count: number }>;
};

function asJson<T>(text: string): T | { ok: false; error: string; detail?: string } {
  try {
    return JSON.parse(text) as T;
  } catch {
    return { ok: false, error: 'bad_json', detail: text };
  }
}

async function get<T>(path: string) {
  const r = await fetch(`${API_BASE}${path}`);
  const t = await r.text();
  return asJson<T>(t);
}

async function post<T>(path: string, body: any) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  return asJson<T>(t);
}

export async function getProducts(): Promise<Product[]> {
  const res: any = await get<any>('/products');
  if (!res || res.ok === false) throw new Error(res?.error || 'Kunne ikke hente produkter');
  const data = res.data ?? res;
  const list = Array.isArray(data) ? data : data.products ?? data.Products ?? [];
  return (list as any[]).map((p) => ({
    Id: p.Id ?? p.id ?? p.ProductId ?? p.productId,
    Name: p.Name ?? p.name,
    Description: p.Description ?? p.description,
    Image: p.Image ?? p.image ?? null,
    Currency: p.Currency ?? p.currency,
    PriceGross: p.PriceGross ?? p.priceGross ?? p.Price ?? p.price,
  })) as Product[];
}

export async function previewBooking(body: Omit<CreateBody, 'openStage'>): Promise<PreviewData> {
  const res: any = await post<any>('/booking/preview', body);
  if (!res || res.ok === false) throw new Error(res?.error || res?.detail || 'Preview feilet');
  return res.data as PreviewData;
}

export async function createBooking(body: CreateBody): Promise<any> {
  const res: any = await post<any>('/booking/create', body);
  if (!res || res.ok === false) throw new Error(res?.detail || res?.error || 'Create feilet');
  return res; // har .data.nextUrl / bookingUrl*
}

/** Velger beste deeplink fra create-responsen */
export function chooseDeepLink(result: any): string | undefined {
  const d = (result && (result.data ?? result)) || {};
  return d.nextUrl || d.bookingUrlSummary || d.bookingUrlRates || d.bookingUrlCategories;
}
