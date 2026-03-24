import { Resend } from 'resend';

type FlightEmailInput = {
  to: string;
  locale?: string | null;
  givenName?: string | null;
  bnoBookingRef: string;
  orderId?: string | null;
  airline?: string | null;
  origin?: string | null;
  destination?: string | null;
  outboundDeparture?: string | null;
  outboundArrival?: string | null;
  returnDeparture?: string | null;
  returnArrival?: string | null;
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

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  try {
    return new Intl.DateTimeFormat('nb-NO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function isEnglish(locale?: string | null) {
  return String(locale || '').toLowerCase().startsWith('en');
}

function buildSubject(input: FlightEmailInput) {
  if (isEnglish(input.locale)) {
    return `Your trip is confirmed ✈️ ${input.bnoBookingRef}`;
  }
  return `Hurra! Reisen din er bekreftet ✈️ ${input.bnoBookingRef}`;
}

function buildHtml(input: FlightEmailInput) {
  const greetingName = input.givenName?.trim() || 'kunde';

  if (isEnglish(input.locale)) {
    return `
      <div style="font-family: Arial, Helvetica, sans-serif; color:#0f172a; line-height:1.6;">
        <h1 style="margin-bottom:8px;">Your trip is confirmed ✈️</h1>
        <p>Hi ${greetingName},</p>
        <p>Your flight booking has been successfully created.</p>

        <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin:20px 0;">
          <p style="margin:0 0 8px 0;"><strong>BNO reference:</strong> ${input.bnoBookingRef}</p>
          <p style="margin:0 0 8px 0;"><strong>Duffel order ID:</strong> ${input.orderId || '-'}</p>
          <p style="margin:0 0 8px 0;"><strong>Airline:</strong> ${input.airline || '-'}</p>
          <p style="margin:0 0 8px 0;"><strong>Route:</strong> ${input.origin || '-'} → ${input.destination || '-'}</p>
          <p style="margin:0 0 8px 0;"><strong>Outbound:</strong> ${formatDateTime(input.outboundDeparture)} → ${formatDateTime(input.outboundArrival)}</p>
          <p style="margin:0;"><strong>Return:</strong> ${formatDateTime(input.returnDeparture)} → ${formatDateTime(input.returnArrival)}</p>
        </div>

        <p>Keep this email as your receipt and booking confirmation.</p>
        <p>Thank you for booking with BNO Travel.</p>
      </div>
    `;
  }

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#0f172a; line-height:1.6;">
      <h1 style="margin-bottom:8px;">Hurra! Reisen din er bekreftet ✈️</h1>
      <p>Hei ${greetingName},</p>
      <p>Flybookingen din er opprettet.</p>

      <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin:20px 0;">
        <p style="margin:0 0 8px 0;"><strong>BNO-referanse:</strong> ${input.bnoBookingRef}</p>
        <p style="margin:0 0 8px 0;"><strong>Duffel order ID:</strong> ${input.orderId || '-'}</p>
        <p style="margin:0 0 8px 0;"><strong>Flyselskap:</strong> ${input.airline || '-'}</p>
        <p style="margin:0 0 8px 0;"><strong>Rute:</strong> ${input.origin || '-'} → ${input.destination || '-'}</p>
        <p style="margin:0 0 8px 0;"><strong>Utreise:</strong> ${formatDateTime(input.outboundDeparture)} → ${formatDateTime(input.outboundArrival)}</p>
        <p style="margin:0;"><strong>Retur:</strong> ${formatDateTime(input.returnDeparture)} → ${formatDateTime(input.returnArrival)}</p>
      </div>

      <p>Ta vare på denne e-posten som kvittering og bekreftelse.</p>
      <p>Takk for at du bestilte med BNO Travel.</p>
    </div>
  `;
}

function buildText(input: FlightEmailInput) {
  if (isEnglish(input.locale)) {
    return [
      'Your trip is confirmed ✈️',
      '',
      `BNO reference: ${input.bnoBookingRef}`,
      `Duffel order ID: ${input.orderId || '-'}`,
      `Airline: ${input.airline || '-'}`,
      `Route: ${input.origin || '-'} -> ${input.destination || '-'}`,
      `Outbound: ${formatDateTime(input.outboundDeparture)} -> ${formatDateTime(input.outboundArrival)}`,
      `Return: ${formatDateTime(input.returnDeparture)} -> ${formatDateTime(input.returnArrival)}`,
    ].join('\n');
  }

  return [
    'Hurra! Reisen din er bekreftet ✈️',
    '',
    `BNO-referanse: ${input.bnoBookingRef}`,
    `Duffel order ID: ${input.orderId || '-'}`,
    `Flyselskap: ${input.airline || '-'}`,
    `Rute: ${input.origin || '-'} -> ${input.destination || '-'}`,
    `Utreise: ${formatDateTime(input.outboundDeparture)} -> ${formatDateTime(input.outboundArrival)}`,
    `Retur: ${formatDateTime(input.returnDeparture)} -> ${formatDateTime(input.returnArrival)}`,
  ].join('\n');
}

export async function sendFlightBookingConfirmationEmail(input: FlightEmailInput) {
  const resend = getResendClient();

  const response = await resend.emails.send({
    from: getEmailFrom(),
    to: [input.to],
    subject: buildSubject(input),
    html: buildHtml(input),
    text: buildText(input),
    replyTo: getReplyTo(),
  });

  if (response.error) {
    throw new Error(response.error.message || 'Kunne ikke sende e-post');
  }

  return response.data;
}