import { Duffel } from '@duffel/api';

const token = process.env.DUFFEL_ACCESS_TOKEN?.trim();

if (!token) {
  console.warn('[DUFFEL] DUFFEL_ACCESS_TOKEN is missing');
}

export const duffel = new Duffel({
  token: token || '',
});