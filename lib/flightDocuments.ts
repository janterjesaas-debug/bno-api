import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';

export type FlightDocumentAttachment = {
  filename: string;
  content: Buffer;
  contentType: 'application/pdf';
};

export type FlightDocumentsInput = {
  locale?: string | null;
  bnoBookingRef: string;
  orderId?: string | null;
  airline?: string | null;
  origin?: string | null;
  destination?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  passengers?: any[] | null;
  order?: any | null;
  offer?: any | null;
  totalAmount?: number | null;
  currency?: string | null;
  serviceFee?: number | null;
  paymentBrand?: string | null;
  paymentLast4?: string | null;
};

type PdfTextOptions = {
  size?: number;
  font?: PDFFont;
  color?: ReturnType<typeof rgb>;
  maxWidth?: number;
  lineHeight?: number;
};

type NormalizedSegment = {
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string;
  departingAt: string;
  arrivingAt: string;
  flightNumber: string;
  marketingCarrier: string;
  operatingCarrier: string;
  fareBrand: string;
  cabinBaggage: string;
  checkedBaggage: string;
  seat: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 42;
const TOP_Y = PAGE_HEIGHT - 42;
const BNO_DARK = rgb(0.047, 0.102, 0.22);
const MUTED = rgb(0.38, 0.44, 0.52);
const BORDER = rgb(0.88, 0.9, 0.93);
const LIGHT_BG = rgb(0.972, 0.98, 0.992);
const GREEN = rgb(0.03, 0.48, 0.36);

function normalizeLocale(locale?: string | null) {
  const raw = String(locale || 'nb').toLowerCase().trim();

  if (
    raw === 'no' ||
    raw === 'nb' ||
    raw === 'nb-no' ||
    raw === 'nn' ||
    raw === 'nn-no' ||
    raw.startsWith('nb-') ||
    raw.startsWith('nn-')
  ) {
    return 'nb';
  }

  if (raw.startsWith('da')) return 'da';
  if (raw.startsWith('sv')) return 'sv';
  if (raw.startsWith('de')) return 'de';
  if (raw.startsWith('fr')) return 'fr';
  if (raw.startsWith('es')) return 'es';
  if (raw.startsWith('it')) return 'it';
  if (raw.startsWith('nl')) return 'nl';
  if (raw.startsWith('pl')) return 'pl';
  if (raw.startsWith('fi')) return 'fi';
  if (raw.startsWith('is')) return 'is';
  if (raw.startsWith('tr')) return 'tr';
  if (raw.startsWith('pt')) return 'pt';
  if (raw.startsWith('ar')) return 'ar';
  if (raw.startsWith('zh')) return 'zh';
  if (raw.startsWith('ja')) return 'ja';
  if (raw.startsWith('ko')) return 'ko';
  if (raw.startsWith('hi')) return 'hi';
  if (raw.startsWith('id')) return 'id';
  if (raw.startsWith('th')) return 'th';

  return 'en';
}

function isNorwegian(locale?: string | null) {
  return normalizeLocale(locale) === 'nb';
}

function text(input: FlightDocumentsInput, nb: string, en: string) {
  return isNorwegian(input.locale) ? nb : en;
}

function safe(value: any, fallback = '-') {
  const str = String(value ?? '').trim();
  return str || fallback;
}

function stripUnsupportedPdfChars(value: any) {
  return String(value ?? '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDateTime(value?: string | null, locale?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);

  const normalized = normalizeLocale(locale);

  const localeMap: Record<string, string> = {
    nb: 'nb-NO',
    da: 'da-DK',
    sv: 'sv-SE',
    de: 'de-DE',
    fr: 'fr-FR',
    es: 'es-ES',
    it: 'it-IT',
    nl: 'nl-NL',
    pl: 'pl-PL',
    fi: 'fi-FI',
    is: 'is-IS',
    tr: 'tr-TR',
    pt: 'pt-PT',
    en: 'en-GB',
  };

  try {
    return new Intl.DateTimeFormat(localeMap[normalized] || 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function formatMoney(amount: any, currency?: string | null) {
  const n = Number(amount || 0);
  const c = String(currency || 'EUR').toUpperCase();

  if (!Number.isFinite(n)) return `0 ${c}`;

  try {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: c,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${c}`;
  }
}

function getPassengerName(input: FlightDocumentsInput) {
  const firstPassenger =
    Array.isArray(input.passengers) && input.passengers.length > 0
      ? input.passengers[0]
      : null;

  const given =
    input.givenName ||
    firstPassenger?.given_name ||
    firstPassenger?.givenName ||
    firstPassenger?.first_name ||
    firstPassenger?.firstName ||
    '';

  const family =
    input.familyName ||
    firstPassenger?.family_name ||
    firstPassenger?.familyName ||
    firstPassenger?.last_name ||
    firstPassenger?.lastName ||
    '';

  const full = `${safe(given, '')} ${safe(family, '')}`.trim();
  return full || safe(firstPassenger?.name, text(input, 'Kunde', 'Customer'));
}

function getPassengerDisplayName(input: FlightDocumentsInput) {
  const name = getPassengerName(input);
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) return name.toUpperCase();

  const family = parts[parts.length - 1];
  const given = parts.slice(0, -1).join(' ');

  return `${family}/${given}`.toUpperCase();
}

function asArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function objectText(value: any) {
  try {
    return JSON.stringify(value || {}).toLowerCase();
  } catch {
    return '';
  }
}

function getCarrierName(segment: any, input: FlightDocumentsInput) {
  return (
    segment?.marketing_carrier?.name ||
    segment?.operating_carrier?.name ||
    segment?.aircraft?.name ||
    input.airline ||
    input.order?.owner?.name ||
    input.offer?.owner?.name ||
    text(input, 'Flyselskap', 'Airline')
  );
}

function getFlightNumber(segment: any) {
  const carrierCode =
    segment?.marketing_carrier?.iata_code ||
    segment?.operating_carrier?.iata_code ||
    '';

  const number =
    segment?.marketing_carrier_flight_number ||
    segment?.operating_carrier_flight_number ||
    segment?.flight_number ||
    '';

  if (carrierCode && number) return `${carrierCode}${number}`;
  return String(number || carrierCode || '-');
}

function getFareBrand(source: any) {
  return (
    source?.fare_brand_name ||
    source?.fare_brand ||
    source?.brand_name ||
    source?.fare_name ||
    source?.conditions?.fare_brand_name ||
    source?.slices?.[0]?.fare_brand_name ||
    source?.slices?.[0]?.fare_brand ||
    ''
  );
}

function inferFareBrand(source: any) {
  const direct = getFareBrand(source);
  if (direct) return String(direct);

  const txt = objectText(source);

  if (txt.includes('lowfare plus') || txt.includes('lowfare+')) return 'LowFare+';
  if (txt.includes('lowfare')) return 'LowFare';
  if (txt.includes('flex')) return 'Flex';
  if (txt.includes('plus')) return 'Plus';
  if (txt.includes('basic')) return 'Basic';
  if (txt.includes('standard')) return 'Standard';

  return '';
}

function hasCabinBaggage(source: any) {
  const txt = objectText(source);
  return (
    txt.includes('cabin') ||
    txt.includes('carry') ||
    txt.includes('hand baggage') ||
    txt.includes('handbagasje') ||
    txt.includes('personal item') ||
    txt.includes('under seat') ||
    txt.includes('under-seat')
  );
}

function hasCheckedBaggage(source: any) {
  const txt = objectText(source);
  return (
    txt.includes('checked') ||
    txt.includes('hold luggage') ||
    txt.includes('checked baggage') ||
    txt.includes('innsjekket') ||
    txt.includes('23 kg') ||
    txt.includes('23kg')
  );
}

function getCabinBaggageText(input: FlightDocumentsInput, source: any, fareBrand: string) {
  const f = fareBrand.toLowerCase();

  if (f.includes('lowfare') || f.includes('flex') || hasCabinBaggage(source)) {
    return text(
      input,
      'Liten veske under setet / håndbagasje etter billettype',
      'Small under-seat bag / cabin baggage according to fare type'
    );
  }

  return text(input, 'Ikke spesifisert', 'Not specified');
}

function getCheckedBaggageText(input: FlightDocumentsInput, source: any, fareBrand: string) {
  const f = fareBrand.toLowerCase();

  if (f.includes('flex')) {
    return text(input, 'Innsjekket bagasje inkludert etter Flex-vilkår', 'Checked baggage included according to Flex fare rules');
  }

  if (f.includes('lowfare+') || f.includes('lowfare plus') || f.includes('plus')) {
    return text(input, '1 innsjekket bagasje etter billettype', '1 checked bag according to fare type');
  }

  if (hasCheckedBaggage(source)) {
    return text(input, 'Innsjekket bagasje inkludert', 'Checked baggage included');
  }

  return text(input, 'Ikke forhåndsbetalt bagasje', 'No prepaid checked baggage');
}

function normalizeSegments(input: FlightDocumentsInput): NormalizedSegment[] {
  const source = input.order || input.offer || {};
  const slices = asArray(source?.slices);

  const segments: NormalizedSegment[] = [];

  for (const slice of slices) {
    const sliceFareBrand = inferFareBrand(slice) || inferFareBrand(source);
    for (const segment of asArray(slice?.segments)) {
      const fareBrand = inferFareBrand(segment) || sliceFareBrand || text(input, 'Billettype', 'Fare type');

      segments.push({
        origin:
          segment?.origin?.city_name ||
          segment?.origin?.name ||
          segment?.origin?.iata_code ||
          input.origin ||
          '-',
        originCode: segment?.origin?.iata_code || '',
        destination:
          segment?.destination?.city_name ||
          segment?.destination?.name ||
          segment?.destination?.iata_code ||
          input.destination ||
          '-',
        destinationCode: segment?.destination?.iata_code || '',
        departingAt: segment?.departing_at || segment?.departure_time || '',
        arrivingAt: segment?.arriving_at || segment?.arrival_time || '',
        flightNumber: getFlightNumber(segment),
        marketingCarrier: getCarrierName(segment, input),
        operatingCarrier:
          segment?.operating_carrier?.name ||
          segment?.marketing_carrier?.name ||
          getCarrierName(segment, input),
        fareBrand,
        cabinBaggage: getCabinBaggageText(input, segment, fareBrand),
        checkedBaggage: getCheckedBaggageText(input, segment, fareBrand),
        seat: text(input, 'Ikke reservert', 'Not reserved'),
      });
    }
  }

  if (segments.length > 0) return segments;

  return [
    {
      origin: input.origin || '-',
      originCode: '',
      destination: input.destination || '-',
      destinationCode: '',
      departingAt: '',
      arrivingAt: '',
      flightNumber: '-',
      marketingCarrier: input.airline || '-',
      operatingCarrier: input.airline || '-',
      fareBrand: inferFareBrand(source) || '-',
      cabinBaggage: text(input, 'Ikke spesifisert', 'Not specified'),
      checkedBaggage: text(input, 'Ikke spesifisert', 'Not specified'),
      seat: text(input, 'Ikke reservert', 'Not reserved'),
    },
  ];
}

function getOrderAmount(input: FlightDocumentsInput) {
  const source = input.order || input.offer || {};
  return Number(
    input.totalAmount ??
      source?.total_amount ??
      source?.amount ??
      source?.payment?.amount ??
      0
  );
}

function getCurrency(input: FlightDocumentsInput) {
  const source = input.order || input.offer || {};
  return String(input.currency || source?.total_currency || source?.currency || 'EUR').toUpperCase();
}

function drawText(
  page: PDFPage,
  value: any,
  x: number,
  y: number,
  options: PdfTextOptions = {}
) {
  const font = options.font;
  if (!font) throw new Error('Missing font');

  const size = options.size || 10;
  const color = options.color || BNO_DARK;
  const maxWidth = options.maxWidth;

  const clean = stripUnsupportedPdfChars(value);

  if (!maxWidth) {
    page.drawText(clean, { x, y, size, font, color });
    return y - (options.lineHeight || size + 4);
  }

  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);

    if (width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  let cursor = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= options.lineHeight || size + 4;
  }

  return cursor;
}

function drawBox(page: PDFPage, x: number, y: number, width: number, height: number) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: LIGHT_BG,
    borderColor: BORDER,
    borderWidth: 1,
  });
}

function drawDivider(page: PDFPage, y: number) {
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: PAGE_WIDTH - MARGIN_X, y },
    thickness: 1,
    color: BORDER,
  });
}

function addHeader(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  input: FlightDocumentsInput,
  title: string,
  subtitle: string
) {
  page.drawText('BNO Travel', {
    x: MARGIN_X,
    y: TOP_Y,
    size: 18,
    font: fonts.bold,
    color: BNO_DARK,
  });

  page.drawText(stripUnsupportedPdfChars(title), {
    x: MARGIN_X,
    y: TOP_Y - 34,
    size: 24,
    font: fonts.bold,
    color: BNO_DARK,
  });

  page.drawText(stripUnsupportedPdfChars(subtitle), {
    x: MARGIN_X,
    y: TOP_Y - 56,
    size: 10,
    font: fonts.regular,
    color: MUTED,
  });

  page.drawText(stripUnsupportedPdfChars(`${text(input, 'Generert', 'Generated')}: ${formatDateTime(new Date().toISOString(), input.locale)}`), {
    x: MARGIN_X,
    y: TOP_Y - 74,
    size: 9,
    font: fonts.regular,
    color: MUTED,
  });

  drawDivider(page, TOP_Y - 88);

  return TOP_Y - 116;
}

async function createBasePdf() {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  return {
    doc,
    fonts: { regular, bold },
  };
}

export async function createFlightReceiptPdf(input: FlightDocumentsInput): Promise<Buffer> {
  const { doc, fonts } = await createBasePdf();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const currency = getCurrency(input);
  const amount = getOrderAmount(input);
  const serviceFee = Number(input.serviceFee || 0);
  const segments = normalizeSegments(input);
  const passengerName = getPassengerDisplayName(input);

  let y = addHeader(
    page,
    fonts,
    input,
    text(input, 'Reisekvittering', 'Travel receipt'),
    text(input, 'Ikke gyldig for reise. Bruk reisedokumentet som reiseinformasjon.', 'Not valid for travel. Use the travel document for travel information.')
  );

  drawBox(page, MARGIN_X, y - 86, PAGE_WIDTH - MARGIN_X * 2, 86);

  let boxY = y - 24;
  boxY = drawText(page, `${text(input, 'BNO-referanse', 'BNO reference')}: ${input.bnoBookingRef}`, MARGIN_X + 14, boxY, {
    font: fonts.bold,
    size: 11,
    maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 28,
  });
  boxY = drawText(page, `${text(input, 'Duffel order ID', 'Duffel order ID')}: ${safe(input.orderId || input.order?.id)}`, MARGIN_X + 14, boxY, {
    font: fonts.regular,
    size: 10,
    color: MUTED,
    maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 28,
  });
  boxY = drawText(page, `${text(input, 'Passasjer', 'Passenger')}: ${passengerName}`, MARGIN_X + 14, boxY, {
    font: fonts.regular,
    size: 10,
    color: MUTED,
    maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 28,
  });

  y -= 120;

  page.drawText(stripUnsupportedPdfChars(text(input, 'Kjøpsoversikt', 'Purchase overview')), {
    x: MARGIN_X,
    y,
    size: 16,
    font: fonts.bold,
    color: BNO_DARK,
  });

  y -= 26;
  drawDivider(page, y);
  y -= 22;

  for (const segment of segments) {
    if (y < 120) {
      const nextPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = TOP_Y;
      page.drawText('');
      drawDivider(nextPage, y);
    }

    const route = `${segment.origin} - ${segment.destination}`;
    const flight = `${segment.flightNumber} ${route} - ${formatDateTime(segment.departingAt, input.locale)}`;
    const fare = segment.fareBrand ? ` - ${segment.fareBrand}` : '';

    y = drawText(page, `${route}${fare}`, MARGIN_X, y, {
      font: fonts.bold,
      size: 11,
      maxWidth: 360,
    });

    y = drawText(page, flight, MARGIN_X + 12, y, {
      font: fonts.regular,
      size: 9,
      color: MUTED,
      maxWidth: 360,
    });

    y = drawText(page, passengerName, MARGIN_X + 12, y, {
      font: fonts.regular,
      size: 9,
      color: MUTED,
      maxWidth: 360,
    });

    drawDivider(page, y - 6);
    y -= 24;
  }

  const totalsX = PAGE_WIDTH - MARGIN_X - 190;

  y -= 4;
  page.drawText(stripUnsupportedPdfChars(text(input, 'Pris', 'Price')), {
    x: totalsX,
    y,
    size: 11,
    font: fonts.bold,
    color: BNO_DARK,
  });

  page.drawText(stripUnsupportedPdfChars(formatMoney(Math.max(0, amount - serviceFee), currency)), {
    x: PAGE_WIDTH - MARGIN_X - 90,
    y,
    size: 11,
    font: fonts.bold,
    color: BNO_DARK,
  });

  y -= 18;

  if (serviceFee > 0) {
    page.drawText(stripUnsupportedPdfChars(text(input, 'BNO servicegebyr', 'BNO service fee')), {
      x: totalsX,
      y,
      size: 10,
      font: fonts.regular,
      color: MUTED,
    });

    page.drawText(stripUnsupportedPdfChars(formatMoney(serviceFee, currency)), {
      x: PAGE_WIDTH - MARGIN_X - 90,
      y,
      size: 10,
      font: fonts.regular,
      color: MUTED,
    });

    y -= 18;
  }

  drawDivider(page, y);
  y -= 22;

  page.drawText(stripUnsupportedPdfChars(text(input, 'Totalbeløp', 'Total amount')), {
    x: totalsX,
    y,
    size: 13,
    font: fonts.bold,
    color: BNO_DARK,
  });

  page.drawText(stripUnsupportedPdfChars(formatMoney(amount, currency)), {
    x: PAGE_WIDTH - MARGIN_X - 100,
    y,
    size: 13,
    font: fonts.bold,
    color: BNO_DARK,
  });

  y -= 38;

  const paymentText =
    input.paymentBrand || input.paymentLast4
      ? `${safe(input.paymentBrand, 'Kort')} ${input.paymentLast4 ? `****${input.paymentLast4}` : ''}`
      : text(input, 'Betalt med kort', 'Paid by card');

  y = drawText(page, `${text(input, 'Betalingsform', 'Payment method')}: ${paymentText}`, MARGIN_X, y, {
    font: fonts.regular,
    size: 10,
    color: MUTED,
    maxWidth: PAGE_WIDTH - MARGIN_X * 2,
  });

  y -= 18;

  drawText(
    page,
    text(
      input,
      'Denne kvitteringen er utstedt av BNO Travel for bestillingen. Flyselskapets egne regler, vilkår og eventuelle gebyrer gjelder.',
      "This receipt is issued by BNO Travel for the booking. The airline's own rules, conditions and applicable fees apply."
    ),
    MARGIN_X,
    y,
    {
      font: fonts.regular,
      size: 9,
      color: MUTED,
      maxWidth: PAGE_WIDTH - MARGIN_X * 2,
      lineHeight: 13,
    }
  );

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export async function createFlightTravelDocumentPdf(input: FlightDocumentsInput): Promise<Buffer> {
  const { doc, fonts } = await createBasePdf();
  const segments = normalizeSegments(input);
  const passengerName = getPassengerDisplayName(input);

  for (let idx = 0; idx < segments.length; idx += 1) {
    const segment = segments[idx];
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    let y = addHeader(
      page,
      fonts,
      input,
      text(input, 'Reisedokument', 'Travel document'),
      `${passengerName} - ${segment.origin} - ${segment.destination}`
    );

    page.drawText(stripUnsupportedPdfChars(`${segment.origin} - ${segment.destination}`), {
      x: MARGIN_X,
      y,
      size: 17,
      font: fonts.bold,
      color: BNO_DARK,
    });

    y -= 24;

    const flightLine = `${segment.flightNumber} - ${formatDateTime(segment.departingAt, input.locale)} - ${segment.fareBrand}`;
    y = drawText(page, flightLine, MARGIN_X, y, {
      font: fonts.regular,
      size: 11,
      color: MUTED,
      maxWidth: PAGE_WIDTH - MARGIN_X * 2,
    });

    y -= 18;

    drawBox(page, MARGIN_X, y - 256, PAGE_WIDTH - MARGIN_X * 2, 256);
    y -= 24;

    const labelX = MARGIN_X + 16;
    const valueX = MARGIN_X + 180;
    const maxValueWidth = PAGE_WIDTH - valueX - MARGIN_X - 16;

    const rows: Array<[string, string]> = [
      [text(input, 'Bookingreferanse', 'Booking reference'), input.bnoBookingRef],
      [text(input, 'Passasjer', 'Passenger'), passengerName],
      [text(input, 'Flyvning', 'Flight'), segment.flightNumber],
      [text(input, 'Avreise', 'Departure'), `${formatDateTime(segment.departingAt, input.locale)} ${segment.origin} ${segment.originCode ? `(${segment.originCode})` : ''}`],
      [text(input, 'Ankomst', 'Arrival'), `${formatDateTime(segment.arrivingAt, input.locale)} ${segment.destination} ${segment.destinationCode ? `(${segment.destinationCode})` : ''}`],
      [text(input, 'Flyselskap', 'Airline'), segment.marketingCarrier],
      [text(input, 'Opereres av', 'Operated by'), segment.operatingCarrier],
      [text(input, 'Sete', 'Seat'), segment.seat],
      [text(input, 'Håndbagasje', 'Hand baggage'), segment.cabinBaggage],
      [text(input, 'Innsjekket bagasje', 'Checked baggage'), segment.checkedBaggage],
      [text(input, 'Priskategori', 'Price category'), segment.fareBrand],
      [text(input, 'Dokumentnummer', 'Document number'), `${input.bnoBookingRef}-${idx + 1}`],
    ];

    for (const [label, value] of rows) {
      page.drawText(stripUnsupportedPdfChars(label), {
        x: labelX,
        y,
        size: 9,
        font: fonts.bold,
        color: BNO_DARK,
      });

      const nextY = drawText(page, value, valueX, y, {
        font: fonts.regular,
        size: 9,
        color: MUTED,
        maxWidth: maxValueWidth,
        lineHeight: 12,
      });

      y = Math.min(y - 18, nextY - 4);
    }

    y -= 34;

    page.drawText(stripUnsupportedPdfChars(text(input, 'Viktig informasjon', 'Important information')), {
      x: MARGIN_X,
      y,
      size: 15,
      font: fonts.bold,
      color: BNO_DARK,
    });

    y -= 22;

    const info = text(
      input,
      'Alle passasjerer må ha gyldig identifikasjon og nødvendige reisedokumenter for reisen. Sjekk inn hos flyselskapet før avreise. Bagasjeregler, setereservasjon, innsjekkingsfrister og endringsvilkår følger flyselskapets regler og valgt billettype.',
      'All passengers must carry valid identification and required travel documents. Check in with the airline before departure. Baggage rules, seat reservation, check-in deadlines and change conditions follow the airline rules and selected fare type.'
    );

    y = drawText(page, info, MARGIN_X, y, {
      font: fonts.regular,
      size: 10,
      color: MUTED,
      maxWidth: PAGE_WIDTH - MARGIN_X * 2,
      lineHeight: 15,
    });

    y -= 18;

    drawText(
      page,
      text(
        input,
        'Dette dokumentet er generert av BNO Travel basert på bekreftet bookinginformasjon.',
        'This document is generated by BNO Travel based on confirmed booking information.'
      ),
      MARGIN_X,
      y,
      {
        font: fonts.regular,
        size: 9,
        color: GREEN,
        maxWidth: PAGE_WIDTH - MARGIN_X * 2,
      }
    );
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export async function buildFlightDocumentAttachments(
  input: FlightDocumentsInput
): Promise<FlightDocumentAttachment[]> {
  const receiptPdf = await createFlightReceiptPdf(input);
  const travelDocumentPdf = await createFlightTravelDocumentPdf(input);

  return [
    {
      filename: isNorwegian(input.locale)
        ? 'BNO Travel - Reisekvittering.pdf'
        : 'BNO Travel - Travel receipt.pdf',
      content: receiptPdf,
      contentType: 'application/pdf',
    },
    {
      filename: isNorwegian(input.locale)
        ? 'BNO Travel - Reisedokument.pdf'
        : 'BNO Travel - Travel document.pdf',
      content: travelDocumentPdf,
      contentType: 'application/pdf',
    },
  ];
}