import { Resend } from 'resend';
import {
  createFlightReceiptPdf,
  createFlightTravelDocumentPdf,
  FlightDocumentsInput,
} from './flightDocuments';

export type FlightEmailInput = {
  to: string;
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

function getResendClient() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();

  if (!apiKey) {
    throw new Error('RESEND_API_KEY mangler på serveren');
  }

  return new Resend(apiKey);
}

function getEmailFrom() {
  return (
    String(process.env.EMAIL_FROM || '').trim() ||
    'BNO Travel <onboarding@resend.dev>'
  );
}

function getReplyTo() {
  const value = String(process.env.EMAIL_REPLY_TO || '').trim();
  return value || undefined;
}

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

function isEnglish(locale?: string | null) {
  return normalizeLocale(locale) === 'en';
}

function escapeHtml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateTime(value?: string | null, locale?: string | null) {
  if (!value) return '-';

  try {
    return new Intl.DateTimeFormat(isEnglish(locale) ? 'en-GB' : 'nb-NO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function buildSubject(input: FlightEmailInput) {
  if (isEnglish(input.locale)) {
    return `Your trip is confirmed ✈️ ${input.bnoBookingRef}`;
  }

  return `Reisen din er bekreftet ✈️ ${input.bnoBookingRef}`;
}

function buildHtml(input: FlightEmailInput) {
  const greetingName = input.givenName?.trim() || (isEnglish(input.locale) ? 'customer' : 'kunde');

  const labels = isEnglish(input.locale)
    ? {
        title: 'Your trip is confirmed ✈️',
        hi: 'Hi',
        intro: 'Your flight booking has been successfully created.',
        bnoRef: 'BNO reference',
        orderId: 'Duffel order ID',
        airline: 'Airline',
        route: 'Route',
        outbound: 'Outbound',
        returnTrip: 'Return',
        docsTitle: 'Travel documents',
        docsText:
          'We have attached your receipt and travel document as PDF files. Keep the documents and check in with the airline before departure.',
        receipt: 'Travel receipt',
        document: 'Travel document',
        keep: 'Keep this email as your receipt and booking confirmation.',
        thanks: 'Thank you for booking with BNO Travel.',
      }
    : {
        title: 'Reisen din er bekreftet ✈️',
        hi: 'Hei',
        intro: 'Flybookingen din er opprettet.',
        bnoRef: 'BNO-referanse',
        orderId: 'Duffel order ID',
        airline: 'Flyselskap',
        route: 'Rute',
        outbound: 'Utreise',
        returnTrip: 'Retur',
        docsTitle: 'Reisedokumenter',
        docsText:
          'Vi har lagt ved reisekvittering og reisedokument som PDF. Ta vare på dokumentene og sjekk inn hos flyselskapet før avreise.',
        receipt: 'Reisekvittering',
        document: 'Reisedokument',
        keep: 'Ta vare på denne e-posten som kvittering og bekreftelse.',
        thanks: 'Takk for at du bestilte med BNO Travel.',
      };

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#0f172a; line-height:1.6;">
      <h1 style="margin-bottom:8px;">${escapeHtml(labels.title)}</h1>
      <p>${escapeHtml(labels.hi)} ${escapeHtml(greetingName)},</p>
      <p>${escapeHtml(labels.intro)}</p>

      <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin:20px 0;">
        <p style="margin:0 0 8px 0;"><strong>${escapeHtml(labels.bnoRef)}:</strong> ${escapeHtml(input.bnoBookingRef)}</p>
        <p style="margin:0 0 8px 0;"><strong>${escapeHtml(labels.orderId)}:</strong> ${escapeHtml(input.orderId || '-')}</p>
        <p style="margin:0 0 8px 0;"><strong>${escapeHtml(labels.airline)}:</strong> ${escapeHtml(input.airline || '-')}</p>
        <p style="margin:0 0 8px 0;"><strong>${escapeHtml(labels.route)}:</strong> ${escapeHtml(input.origin || '-')} → ${escapeHtml(input.destination || '-')}</p>
        <p style="margin:0 0 8px 0;"><strong>${escapeHtml(labels.outbound)}:</strong> ${escapeHtml(formatDateTime(input.outboundDeparture, input.locale))} → ${escapeHtml(formatDateTime(input.outboundArrival, input.locale))}</p>
        <p style="margin:0;"><strong>${escapeHtml(labels.returnTrip)}:</strong> ${escapeHtml(formatDateTime(input.returnDeparture, input.locale))} → ${escapeHtml(formatDateTime(input.returnArrival, input.locale))}</p>
      </div>

      <div style="background:#ecfdf5; border:1px solid #bbf7d0; border-radius:12px; padding:16px; margin:20px 0;">
        <h2 style="font-size:18px; margin:0 0 8px 0; color:#047857;">${escapeHtml(labels.docsTitle)}</h2>
        <p style="margin:0 0 8px 0;">${escapeHtml(labels.docsText)}</p>
        <ul style="margin:0; padding-left:20px;">
          <li>${escapeHtml(labels.receipt)}</li>
          <li>${escapeHtml(labels.document)}</li>
        </ul>
      </div>

      <p>${escapeHtml(labels.keep)}</p>
      <p>${escapeHtml(labels.thanks)}</p>
    </div>
  `;
}

function buildText(input: FlightEmailInput) {
  if (isEnglish(input.locale)) {
    return [
      'Your trip is confirmed',
      '',
      `BNO reference: ${input.bnoBookingRef}`,
      `Duffel order ID: ${input.orderId || '-'}`,
      `Airline: ${input.airline || '-'}`,
      `Route: ${input.origin || '-'} -> ${input.destination || '-'}`,
      `Outbound: ${formatDateTime(input.outboundDeparture, input.locale)} -> ${formatDateTime(input.outboundArrival, input.locale)}`,
      `Return: ${formatDateTime(input.returnDeparture, input.locale)} -> ${formatDateTime(input.returnArrival, input.locale)}`,
      '',
      'Travel documents are attached as PDF files.',
    ].join('\n');
  }

  return [
    'Reisen din er bekreftet',
    '',
    `BNO-referanse: ${input.bnoBookingRef}`,
    `Duffel order ID: ${input.orderId || '-'}`,
    `Flyselskap: ${input.airline || '-'}`,
    `Rute: ${input.origin || '-'} -> ${input.destination || '-'}`,
    `Utreise: ${formatDateTime(input.outboundDeparture, input.locale)} -> ${formatDateTime(input.outboundArrival, input.locale)}`,
    `Retur: ${formatDateTime(input.returnDeparture, input.locale)} -> ${formatDateTime(input.returnArrival, input.locale)}`,
    '',
    'Reisekvittering og reisedokument er lagt ved som PDF.',
  ].join('\n');
}

function toDocumentsInput(input: FlightEmailInput): FlightDocumentsInput {
  return {
    locale: input.locale || 'nb',
    givenName: input.givenName || '',
    familyName: input.familyName || '',
    bnoBookingRef: input.bnoBookingRef,
    orderId: input.orderId || '',
    airline: input.airline || '',
    origin: input.origin || '',
    destination: input.destination || '',
    outboundDeparture: input.outboundDeparture || '',
    outboundArrival: input.outboundArrival || '',
    returnDeparture: input.returnDeparture || '',
    returnArrival: input.returnArrival || '',
    order: input.order,
    offer: input.offer,
    passengers: input.passengers || [],
    totalAmount: Number(input.totalAmount || 0),
    currency: input.currency || 'EUR',
    serviceFee: Number(input.serviceFee || 0),
  };
}

export async function sendFlightBookingConfirmationEmail(input: FlightEmailInput) {
  const resend = getResendClient();
  const documentsInput = toDocumentsInput(input);

  const receiptPdf = await createFlightReceiptPdf(documentsInput);
  const travelDocumentPdf = await createFlightTravelDocumentPdf(documentsInput);

  const response = await resend.emails.send({
    from: getEmailFrom(),
    to: [input.to],
    subject: buildSubject(input),
    html: buildHtml(input),
    text: buildText(input),
    replyTo: getReplyTo(),
    attachments: [
      {
        filename: isEnglish(input.locale)
          ? `BNO Travel - Travel receipt - ${input.bnoBookingRef}.pdf`
          : `BNO Travel - Reisekvittering - ${input.bnoBookingRef}.pdf`,
        content: receiptPdf.toString('base64'),
      },
      {
        filename: isEnglish(input.locale)
          ? `BNO Travel - Travel document - ${input.bnoBookingRef}.pdf`
          : `BNO Travel - Reisedokument - ${input.bnoBookingRef}.pdf`,
        content: travelDocumentPdf.toString('base64'),
      },
    ],
  });

  if (response.error) {
    throw new Error(response.error.message || 'Kunne ikke sende e-post');
  }

  return response.data;
}