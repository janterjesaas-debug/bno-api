import fs from 'fs';
import path from 'path';
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from 'pdf-lib';

export type FlightDocumentsInput = {
  locale?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  bnoBookingRef: string;
  orderId?: string | null;
  airline?: string | null;
  origin?: string | null;
  destination?: string | null;
  outboundDeparture?: string | null;
  outboundArrival?: string | null;
  returnDeparture?: string | null;
  returnArrival?: string | null;
  order?: any;
  offer?: any;
  passengers?: any[];
  totalAmount?: number;
  currency?: string;
  serviceFee?: number;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 46;
const TOP_Y = 790;

const BNO_DARK = rgb(0.02, 0.11, 0.27);
const MUTED = rgb(0.31, 0.39, 0.52);
const LIGHT_BG = rgb(0.96, 0.98, 1);
const BORDER = rgb(0.82, 0.86, 0.91);
const GREEN = rgb(0.02, 0.49, 0.32);

function normalizeLocale(locale?: string | null) {
  const raw = String(locale || 'nb').toLowerCase().trim();

  if (
    raw === 'nb' ||
    raw === 'no' ||
    raw === 'nb-no' ||
    raw === 'nn' ||
    raw === 'nn-no' ||
    raw.startsWith('nb-') ||
    raw.startsWith('nn-')
  ) {
    return 'nb';
  }

  if (raw.startsWith('en')) return 'en';

  return raw || 'nb';
}

function isEnglish(input: FlightDocumentsInput) {
  return normalizeLocale(input.locale) === 'en';
}

function text(input: FlightDocumentsInput, nb: string, en: string) {
  return isEnglish(input) ? en : nb;
}

function safe(value: any, fallback = '-') {
  const cleaned = String(value ?? '').trim();
  return cleaned || fallback;
}

function formatDateTime(value?: string | null, input?: FlightDocumentsInput) {
  if (!value) return '-';

  try {
    const locale = normalizeLocale(input?.locale);
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nb-NO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatMoney(amount: number, currency?: string | null) {
  const value = Number(amount || 0);
  const normalizedCurrency = String(currency || 'EUR').toUpperCase();

  try {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${normalizedCurrency}`;
  }
}

function passengerName(input: FlightDocumentsInput) {
  const firstPassenger = Array.isArray(input.passengers) ? input.passengers[0] : null;

  const given =
    input.givenName ||
    firstPassenger?.given_name ||
    firstPassenger?.givenName ||
    '';
  const family =
    input.familyName ||
    firstPassenger?.family_name ||
    firstPassenger?.familyName ||
    '';

  const name = `${family}/${given}`.trim();
  return name === '/' ? '-' : name.toUpperCase();
}

function getSegments(source: any, sliceIndex: number) {
  const segments = source?.slices?.[sliceIndex]?.segments;
  return Array.isArray(segments) ? segments : [];
}

function getFirstSegment(source: any, sliceIndex: number) {
  const segments = getSegments(source, sliceIndex);
  return segments[0] || null;
}

function getLastSegment(source: any, sliceIndex: number) {
  const segments = getSegments(source, sliceIndex);
  return segments.length ? segments[segments.length - 1] : null;
}

function getCarrier(segment: any, fallback?: string | null) {
  return (
    segment?.marketing_carrier?.name ||
    segment?.operating_carrier?.name ||
    fallback ||
    '-'
  );
}

function getOperatingCarrier(segment: any, fallback?: string | null) {
  return (
    segment?.operating_carrier?.name ||
    segment?.marketing_carrier?.name ||
    fallback ||
    '-'
  );
}

function getAirportLabel(airport: any) {
  const city = airport?.city_name || airport?.name || '';
  const code = airport?.iata_code || '';

  if (city && code) return `${city} (${code})`;
  return city || code || '-';
}

function getAirportShort(airport: any) {
  return airport?.iata_code || airport?.city_name || airport?.name || '-';
}

function getFareBrand(source: any) {
  const raw =
    source?.fare_brand_name ||
    source?.brand_name ||
    source?.fare_name ||
    source?.fare_brand ||
    source?.conditions?.fare_brand_name ||
    source?.conditions?.fare_brand ||
    source?.slices?.[0]?.fare_brand_name ||
    source?.slices?.[0]?.fare_brand ||
    '';

  return String(raw || '').trim() || '-';
}

function getFlightNumber(segment: any) {
  const carrierCode =
    segment?.marketing_carrier?.iata_code ||
    segment?.operating_carrier?.iata_code ||
    '';

  const flightNumber =
    segment?.marketing_carrier_flight_number ||
    segment?.operating_carrier_flight_number ||
    segment?.flight_number ||
    '';

  const combined = `${carrierCode}${flightNumber}`.trim();
  return combined || '-';
}

function getPrimarySource(input: FlightDocumentsInput) {
  return input.order || input.offer || {};
}

function getRouteSegments(input: FlightDocumentsInput) {
  const source = getPrimarySource(input);
  const offer = input.offer || {};

  const outboundFirst = getFirstSegment(source, 0) || getFirstSegment(offer, 0);
  const outboundLast = getLastSegment(source, 0) || getLastSegment(offer, 0);
  const returnFirst = getFirstSegment(source, 1) || getFirstSegment(offer, 1);
  const returnLast = getLastSegment(source, 1) || getLastSegment(offer, 1);

  return {
    outboundFirst,
    outboundLast,
    returnFirst,
    returnLast,
  };
}

function drawText(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  options: {
    font: PDFFont;
    size?: number;
    color?: any;
    maxWidth?: number;
  }
) {
  const size = options.size || 10;
  const color = options.color || BNO_DARK;
  const maxWidth = options.maxWidth || PAGE_WIDTH - MARGIN_X * 2;

  const words = String(value || '').split(/\s+/);
  let line = '';
  let currentY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const width = options.font.widthOfTextAtSize(testLine, size);

    if (width > maxWidth && line) {
      page.drawText(line, {
        x,
        y: currentY,
        size,
        font: options.font,
        color,
      });
      currentY -= size + 4;
      line = word;
    } else {
      line = testLine;
    }
  }

  if (line) {
    page.drawText(line, {
      x,
      y: currentY,
      size,
      font: options.font,
      color,
    });
  }

  return currentY - size - 4;
}

async function createBasePdf() {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let logoImage: any = null;

  try {
    const logoPath =
      process.env.BNO_LOGO_PATH ||
      path.join(process.cwd(), 'assets', 'bno-logo.png');

    if (fs.existsSync(logoPath)) {
      const logoBytes = fs.readFileSync(logoPath);
      logoImage = await doc.embedPng(logoBytes);
    }
  } catch (error: any) {
    console.warn('[FLIGHT DOCS] could not load BNO logo', {
      message: error?.message || String(error),
    });
  }

  return {
    doc,
    fonts: { regular, bold },
    logoImage,
  };
}

function addHeader(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  input: FlightDocumentsInput,
  title: string,
  subtitle: string,
  logoImage?: any
) {
  const titleSize = 24;
  const titleSpacing = 24;
  const generatedSpacing = 46;
  const dividerSpacing = 68;
  let titleY = TOP_Y - 58;

  if (logoImage) {
    const logoWidth = 105;
    const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
    const logoBottomY = TOP_Y - logoHeight + 6;

    titleY = Math.min(titleY, logoBottomY - 22);

    page.drawImage(logoImage, {
      x: MARGIN_X,
      y: logoBottomY,
      width: logoWidth,
      height: logoHeight,
    });
  } else {
    page.drawText('BNO Travel', {
      x: MARGIN_X,
      y: TOP_Y,
      size: 18,
      font: fonts.bold,
      color: BNO_DARK,
    });
  }

  const companyX = PAGE_WIDTH - MARGIN_X - 170;

  page.drawText('BNO Travel AS', {
    x: companyX,
    y: TOP_Y,
    size: 10,
    font: fonts.bold,
    color: BNO_DARK,
  });

  page.drawText('Vestmovegen 7A', {
    x: companyX,
    y: TOP_Y - 14,
    size: 8,
    font: fonts.regular,
    color: MUTED,
  });

  page.drawText('2420 Trysil', {
    x: companyX,
    y: TOP_Y - 26,
    size: 8,
    font: fonts.regular,
    color: MUTED,
  });

  page.drawText('booking@bno-travel.com', {
    x: companyX,
    y: TOP_Y - 38,
    size: 8,
    font: fonts.regular,
    color: MUTED,
  });

  page.drawText('+47 4034 1617', {
    x: companyX,
    y: TOP_Y - 50,
    size: 8,
    font: fonts.regular,
    color: MUTED,
  });

  page.drawText(title, {
    x: MARGIN_X,
    y: titleY,
    size: titleSize,
    font: fonts.bold,
    color: BNO_DARK,
  });

  page.drawText(subtitle, {
    x: MARGIN_X,
    y: titleY - titleSpacing,
    size: 10,
    font: fonts.regular,
    color: MUTED,
  });

  page.drawText(
    `${text(input, 'Generert', 'Generated')}: ${formatDateTime(
      new Date().toISOString(),
      input
    )}`,
    {
      x: MARGIN_X,
      y: titleY - generatedSpacing,
      size: 9,
      font: fonts.regular,
      color: MUTED,
    }
  );

  const dividerY = titleY - dividerSpacing;

  page.drawLine({
    start: { x: MARGIN_X, y: dividerY },
    end: { x: PAGE_WIDTH - MARGIN_X, y: dividerY },
    thickness: 1,
    color: BORDER,
  });

  return dividerY - 36;
}

function drawInfoBox(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  rows: Array<[string, string]>,
  x: number,
  y: number,
  width: number
) {
  const rowHeight = 22;
  const height = rows.length * rowHeight + 22;

  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    color: LIGHT_BG,
    borderColor: BORDER,
    borderWidth: 1,
  });

  let currentY = y - 24;

  for (const [label, value] of rows) {
    page.drawText(label, {
      x: x + 14,
      y: currentY,
      size: 9,
      font: fonts.bold,
      color: BNO_DARK,
    });

    drawText(page, value, x + 170, currentY, {
      font: fonts.regular,
      size: 9,
      color: MUTED,
      maxWidth: width - 190,
    });

    currentY -= rowHeight;
  }

  return y - height - 28;
}

function drawSectionTitle(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  title: string,
  y: number
) {
  page.drawText(title, {
    x: MARGIN_X,
    y,
    size: 18,
    font: fonts.bold,
    color: BNO_DARK,
  });

  page.drawLine({
    start: { x: MARGIN_X, y: y - 24 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: y - 24 },
    thickness: 1,
    color: BORDER,
  });

  return y - 48;
}

function getFlightRows(input: FlightDocumentsInput) {
  const source = getPrimarySource(input);
  const offer = input.offer || source;

  const slices = Array.isArray(source?.slices)
    ? source.slices
    : Array.isArray(offer?.slices)
    ? offer.slices
    : [];

  const rows: Array<{
    title: string;
    subtitle: string;
    passenger: string;
  }> = [];

  slices.forEach((slice: any) => {
    const segments = Array.isArray(slice?.segments) ? slice.segments : [];
    if (!segments.length) return;

    const first = segments[0];
    const last = segments[segments.length - 1];

    const origin = getAirportShort(first?.origin);
    const destination = getAirportShort(last?.destination);
    const cityOrigin = first?.origin?.city_name || origin;
    const cityDestination = last?.destination?.city_name || destination;

    const fare = getFareBrand(source) !== '-' ? getFareBrand(source) : getFareBrand(offer);

    rows.push({
      title: `${cityOrigin} - ${cityDestination} - ${fare}`,
      subtitle: `${getFlightNumber(first)} ${cityOrigin} - ${cityDestination} - ${formatDateTime(
        first?.departing_at,
        input
      )}`,
      passenger: passengerName(input),
    });
  });

  return rows;
}

export async function createFlightReceiptPdf(input: FlightDocumentsInput) {
  const { doc, fonts, logoImage } = await createBasePdf();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  let y = addHeader(
    page,
    fonts,
    input,
    text(input, 'Reisekvittering', 'Travel receipt'),
    text(
      input,
      'Ikke gyldig for reise. Bruk reisedokumentet som reiseinformasjon.',
      'Not valid for travel. Use the travel document for travel information.'
    ),
    logoImage
  );

  page.drawRectangle({
    x: MARGIN_X,
    y: y - 82,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 82,
    color: LIGHT_BG,
    borderColor: BORDER,
    borderWidth: 1,
  });

  page.drawText(`${text(input, 'BNO-referanse', 'BNO reference')}: ${input.bnoBookingRef}`, {
    x: MARGIN_X + 14,
    y: y - 26,
    size: 10,
    font: fonts.bold,
    color: BNO_DARK,
  });

  page.drawText(`${text(input, 'Duffel order ID', 'Duffel order ID')}: ${safe(input.orderId)}`, {
    x: MARGIN_X + 14,
    y: y - 44,
    size: 9,
    font: fonts.regular,
    color: MUTED,
  });

  page.drawText(`${text(input, 'Passasjer', 'Passenger')}: ${passengerName(input)}`, {
    x: MARGIN_X + 14,
    y: y - 62,
    size: 9,
    font: fonts.regular,
    color: MUTED,
  });

  y -= 120;

  y = drawSectionTitle(
    page,
    fonts,
    text(input, 'Kjøpsoversikt', 'Purchase summary'),
    y
  );

  const flightRows = getFlightRows(input);

  for (const row of flightRows) {
    page.drawText(row.title, {
      x: MARGIN_X,
      y,
      size: 11,
      font: fonts.bold,
      color: BNO_DARK,
    });

    page.drawText(row.subtitle, {
      x: MARGIN_X + 12,
      y: y - 17,
      size: 9,
      font: fonts.regular,
      color: MUTED,
    });

    page.drawText(row.passenger, {
      x: MARGIN_X + 12,
      y: y - 32,
      size: 9,
      font: fonts.regular,
      color: MUTED,
    });

    page.drawLine({
      start: { x: MARGIN_X, y: y - 48 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: y - 48 },
      thickness: 1,
      color: BORDER,
    });

    y -= 68;
  }

  const totalAmount = Number(input.totalAmount || 0);
  const serviceFee = Number(input.serviceFee || 0);
  const flightPrice = Math.max(0, totalAmount - serviceFee);

  const priceX = PAGE_WIDTH - MARGIN_X - 210;

  page.drawText(text(input, 'Pris', 'Price'), {
    x: priceX,
    y,
    size: 11,
    font: fonts.bold,
    color: BNO_DARK,
  });

  page.drawText(formatMoney(flightPrice, input.currency), {
    x: priceX + 105,
    y,
    size: 11,
    font: fonts.bold,
    color: BNO_DARK,
  });

  page.drawText(text(input, 'BNO servicegebyr', 'BNO service fee'), {
    x: priceX,
    y: y - 20,
    size: 9,
    font: fonts.regular,
    color: MUTED,
  });

  page.drawText(formatMoney(serviceFee, input.currency), {
    x: priceX + 105,
    y: y - 20,
    size: 9,
    font: fonts.regular,
    color: MUTED,
  });

  page.drawLine({
    start: { x: MARGIN_X, y: y - 42 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: y - 42 },
    thickness: 1,
    color: BORDER,
  });

  page.drawText(text(input, 'Totalbeløp', 'Total amount'), {
    x: priceX,
    y: y - 64,
    size: 13,
    font: fonts.bold,
    color: BNO_DARK,
  });

  page.drawText(formatMoney(totalAmount, input.currency), {
    x: priceX + 105,
    y: y - 64,
    size: 13,
    font: fonts.bold,
    color: BNO_DARK,
  });

  y -= 122;

  page.drawText(text(input, 'Betalingsform: Betalt med kort', 'Payment method: Paid by card'), {
    x: MARGIN_X,
    y,
    size: 9,
    font: fonts.regular,
    color: MUTED,
  });

  drawText(
    page,
    text(
      input,
      'Denne kvitteringen er utstedt av BNO Travel for bestillingen. Flyselskapets egne regler, vilkår og eventuelle gebyr gjelder.',
      'This receipt is issued by BNO Travel for the booking. Airline rules, terms and possible fees apply.'
    ),
    MARGIN_X,
    y - 40,
    {
      font: fonts.regular,
      size: 8,
      color: MUTED,
      maxWidth: PAGE_WIDTH - MARGIN_X * 2,
    }
  );

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export async function createFlightTravelDocumentPdf(input: FlightDocumentsInput) {
  const { doc, fonts, logoImage } = await createBasePdf();
  const source = getPrimarySource(input);
  const offer = input.offer || source;
  const slices = Array.isArray(source?.slices)
    ? source.slices
    : Array.isArray(offer?.slices)
    ? offer.slices
    : [];

  if (!slices.length) {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    addHeader(
      page,
      fonts,
      input,
      text(input, 'Reisedokument', 'Travel document'),
      `${passengerName(input)} - ${safe(input.origin)} - ${safe(input.destination)}`,
      logoImage
    );

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  slices.forEach((slice: any, index: number) => {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const segments = Array.isArray(slice?.segments) ? slice.segments : [];
    const first = segments[0];
    const last = segments[segments.length - 1] || first;

    const originCity = first?.origin?.city_name || getAirportShort(first?.origin);
    const destinationCity = last?.destination?.city_name || getAirportShort(last?.destination);
    const fare = getFareBrand(source) !== '-' ? getFareBrand(source) : getFareBrand(offer);

    let y = addHeader(
      page,
      fonts,
      input,
      text(input, 'Reisedokument', 'Travel document'),
      `${passengerName(input)} - ${originCity} - ${destinationCity}`,
      logoImage
    );

    page.drawText(`${originCity} - ${destinationCity}`, {
      x: MARGIN_X,
      y,
      size: 20,
      font: fonts.bold,
      color: BNO_DARK,
    });

    y -= 28;

    page.drawText(
      `${getFlightNumber(first)} - ${formatDateTime(first?.departing_at, input)} - ${fare}`,
      {
        x: MARGIN_X,
        y,
        size: 10,
        font: fonts.regular,
        color: MUTED,
      }
    );

    y -= 52;

    const rows: Array<[string, string]> = [
      [text(input, 'Bookingreferanse', 'Booking reference'), input.bnoBookingRef],
      [text(input, 'Passasjer', 'Passenger'), passengerName(input)],
      [text(input, 'Flyvning', 'Flight'), getFlightNumber(first)],
      [
        text(input, 'Avreise', 'Departure'),
        `${formatDateTime(first?.departing_at, input)} ${getAirportLabel(first?.origin)}`,
      ],
      [
        text(input, 'Ankomst', 'Arrival'),
        `${formatDateTime(last?.arriving_at, input)} ${getAirportLabel(last?.destination)}`,
      ],
      [text(input, 'Flyselskap', 'Airline'), getCarrier(first, input.airline)],
      [text(input, 'Opereres av', 'Operated by'), getOperatingCarrier(first, input.airline)],
      [text(input, 'Sete', 'Seat'), text(input, 'Ikke reservert', 'Not reserved')],
      [
        text(input, 'Håndbagasje', 'Cabin baggage'),
        text(
          input,
          'Liten veske under setet / håndbagasje etter billettype',
          'Small under-seat bag / cabin baggage according to fare type'
        ),
      ],
      [
        text(input, 'Innsjekket bagasje', 'Checked baggage'),
        fare.toLowerCase().includes('plus') || fare.toLowerCase().includes('flex')
          ? text(input, 'Se flyselskapets regler for valgt billettype', 'See airline rules for selected fare type')
          : text(input, 'Ikke forhåndsbetalt bagasje', 'No prepaid checked baggage'),
      ],
      [text(input, 'Priskategori', 'Fare category'), fare],
      [
        text(input, 'Dokumentnummer', 'Document number'),
        `${input.bnoBookingRef}-${index + 1}`,
      ],
    ];

    y = drawInfoBox(page, fonts, rows, MARGIN_X, y, PAGE_WIDTH - MARGIN_X * 2);

    page.drawText(text(input, 'Viktig informasjon', 'Important information'), {
      x: MARGIN_X,
      y,
      size: 18,
      font: fonts.bold,
      color: BNO_DARK,
    });

    drawText(
      page,
      text(
        input,
        'Alle passasjerer må ha gyldig identifikasjon og nødvendige reisedokumenter for reisen. Sjekk inn hos flyselskapet før avreise. Bagasjeregler, setereservasjon, innsjekkingsfrister og endringsvilkår følger flyselskapets regler og valgt billettype.',
        'All passengers must have valid identification and required travel documents. Check in with the airline before departure. Baggage rules, seat reservation, check-in deadlines and change conditions follow the airline rules and selected fare type.'
      ),
      MARGIN_X,
      y - 30,
      {
        font: fonts.regular,
        size: 9,
        color: MUTED,
        maxWidth: PAGE_WIDTH - MARGIN_X * 2,
      }
    );

    page.drawText(
      text(
        input,
        'Dette dokumentet er generert av BNO Travel basert på bekreftet bookinginformasjon.',
        'This document is generated by BNO Travel based on confirmed booking information.'
      ),
      {
        x: MARGIN_X,
        y: 72,
        size: 9,
        font: fonts.regular,
        color: GREEN,
      }
    );
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}