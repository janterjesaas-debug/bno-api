import { Resend } from 'resend';
import {
  buildFlightDocumentAttachments,
  type FlightDocumentAttachment,
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

  order?: any | null;
  offer?: any | null;
  passengers?: any[] | null;
  totalAmount?: number | null;
  currency?: string | null;
  serviceFee?: number | null;
  paymentBrand?: string | null;
  paymentLast4?: string | null;

  attachments?: FlightDocumentAttachment[];
  skipGeneratedDocuments?: boolean;
};

type Copy = {
  subject: string;
  title: string;
  greeting: string;
  intro: string;
  bnoRef: string;
  orderId: string;
  airline: string;
  route: string;
  outbound: string;
  returnTrip: string;
  documents: string;
  documentsText: string;
  receipt: string;
  travelDocument: string;
  keepEmail: string;
  thanks: string;
};

const COPY: Record<string, Copy> = {
  nb: {
    subject: 'Reisen din er bekreftet',
    title: 'Reisen din er bekreftet',
    greeting: 'Hei',
    intro: 'Flybookingen din er opprettet.',
    bnoRef: 'BNO-referanse',
    orderId: 'Duffel order ID',
    airline: 'Flyselskap',
    route: 'Rute',
    outbound: 'Utreise',
    returnTrip: 'Retur',
    documents: 'Reisedokumenter',
    documentsText:
      'Vi har lagt ved reisekvittering og reisedokument som PDF. Ta vare på dokumentene og sjekk inn hos flyselskapet før avreise.',
    receipt: 'Reisekvittering',
    travelDocument: 'Reisedokument',
    keepEmail: 'Ta vare på denne e-posten som kvittering og bekreftelse.',
    thanks: 'Takk for at du bestilte med BNO Travel.',
  },
  en: {
    subject: 'Your trip is confirmed',
    title: 'Your trip is confirmed',
    greeting: 'Hi',
    intro: 'Your flight booking has been successfully created.',
    bnoRef: 'BNO reference',
    orderId: 'Duffel order ID',
    airline: 'Airline',
    route: 'Route',
    outbound: 'Outbound',
    returnTrip: 'Return',
    documents: 'Travel documents',
    documentsText:
      'We have attached your travel receipt and travel document as PDFs. Keep the documents and check in with the airline before departure.',
    receipt: 'Travel receipt',
    travelDocument: 'Travel document',
    keepEmail: 'Keep this email as your receipt and booking confirmation.',
    thanks: 'Thank you for booking with BNO Travel.',
  },
  da: {
    subject: 'Din rejse er bekræftet',
    title: 'Din rejse er bekræftet',
    greeting: 'Hej',
    intro: 'Din flybooking er oprettet.',
    bnoRef: 'BNO-reference',
    orderId: 'Duffel order ID',
    airline: 'Flyselskab',
    route: 'Rute',
    outbound: 'Udrejse',
    returnTrip: 'Retur',
    documents: 'Rejsedokumenter',
    documentsText:
      'Vi har vedhæftet rejsekvittering og rejsedokument som PDF. Gem dokumenterne og tjek ind hos flyselskabet før afrejse.',
    receipt: 'Rejsekvittering',
    travelDocument: 'Rejsedokument',
    keepEmail: 'Gem denne e-mail som kvittering og bookingbekræftelse.',
    thanks: 'Tak fordi du bookede med BNO Travel.',
  },
  sv: {
    subject: 'Din resa är bekräftad',
    title: 'Din resa är bekräftad',
    greeting: 'Hej',
    intro: 'Din flygbokning har skapats.',
    bnoRef: 'BNO-referens',
    orderId: 'Duffel order ID',
    airline: 'Flygbolag',
    route: 'Rutt',
    outbound: 'Utresa',
    returnTrip: 'Retur',
    documents: 'Resedokument',
    documentsText:
      'Vi har bifogat resekvitto och resedokument som PDF. Spara dokumenten och checka in hos flygbolaget före avgång.',
    receipt: 'Resekvitto',
    travelDocument: 'Resedokument',
    keepEmail: 'Spara detta e-postmeddelande som kvitto och bokningsbekräftelse.',
    thanks: 'Tack för att du bokade med BNO Travel.',
  },
  de: {
    subject: 'Ihre Reise ist bestätigt',
    title: 'Ihre Reise ist bestätigt',
    greeting: 'Hallo',
    intro: 'Ihre Flugbuchung wurde erfolgreich erstellt.',
    bnoRef: 'BNO-Referenz',
    orderId: 'Duffel Order-ID',
    airline: 'Fluggesellschaft',
    route: 'Route',
    outbound: 'Hinflug',
    returnTrip: 'Rückflug',
    documents: 'Reisedokumente',
    documentsText:
      'Wir haben Reisequittung und Reisedokument als PDF angehängt. Bewahren Sie die Dokumente auf und checken Sie vor Abflug bei der Fluggesellschaft ein.',
    receipt: 'Reisequittung',
    travelDocument: 'Reisedokument',
    keepEmail: 'Bewahren Sie diese E-Mail als Quittung und Buchungsbestätigung auf.',
    thanks: 'Vielen Dank für Ihre Buchung bei BNO Travel.',
  },
  fr: {
    subject: 'Votre voyage est confirmé',
    title: 'Votre voyage est confirmé',
    greeting: 'Bonjour',
    intro: 'Votre réservation de vol a été créée.',
    bnoRef: 'Référence BNO',
    orderId: 'ID de commande Duffel',
    airline: 'Compagnie aérienne',
    route: 'Itinéraire',
    outbound: 'Aller',
    returnTrip: 'Retour',
    documents: 'Documents de voyage',
    documentsText:
      'Nous avons joint votre reçu de voyage et votre document de voyage en PDF. Conservez-les et enregistrez-vous auprès de la compagnie avant le départ.',
    receipt: 'Reçu de voyage',
    travelDocument: 'Document de voyage',
    keepEmail: 'Conservez cet e-mail comme reçu et confirmation de réservation.',
    thanks: 'Merci d’avoir réservé avec BNO Travel.',
  },
  es: {
    subject: 'Tu viaje está confirmado',
    title: 'Tu viaje está confirmado',
    greeting: 'Hola',
    intro: 'Tu reserva de vuelo se ha creado correctamente.',
    bnoRef: 'Referencia BNO',
    orderId: 'ID de pedido Duffel',
    airline: 'Aerolínea',
    route: 'Ruta',
    outbound: 'Ida',
    returnTrip: 'Vuelta',
    documents: 'Documentos de viaje',
    documentsText:
      'Hemos adjuntado el recibo y el documento de viaje en PDF. Guarda los documentos y haz el check-in con la aerolínea antes de la salida.',
    receipt: 'Recibo de viaje',
    travelDocument: 'Documento de viaje',
    keepEmail: 'Guarda este correo como recibo y confirmación de reserva.',
    thanks: 'Gracias por reservar con BNO Travel.',
  },
  it: {
    subject: 'Il tuo viaggio è confermato',
    title: 'Il tuo viaggio è confermato',
    greeting: 'Ciao',
    intro: 'La tua prenotazione del volo è stata creata.',
    bnoRef: 'Riferimento BNO',
    orderId: 'ID ordine Duffel',
    airline: 'Compagnia aerea',
    route: 'Rotta',
    outbound: 'Andata',
    returnTrip: 'Ritorno',
    documents: 'Documenti di viaggio',
    documentsText:
      'Abbiamo allegato ricevuta di viaggio e documento di viaggio in PDF. Conserva i documenti ed effettua il check-in con la compagnia prima della partenza.',
    receipt: 'Ricevuta di viaggio',
    travelDocument: 'Documento di viaggio',
    keepEmail: 'Conserva questa email come ricevuta e conferma della prenotazione.',
    thanks: 'Grazie per aver prenotato con BNO Travel.',
  },
  nl: {
    subject: 'Je reis is bevestigd',
    title: 'Je reis is bevestigd',
    greeting: 'Hallo',
    intro: 'Je vluchtboeking is succesvol aangemaakt.',
    bnoRef: 'BNO-referentie',
    orderId: 'Duffel order-ID',
    airline: 'Luchtvaartmaatschappij',
    route: 'Route',
    outbound: 'Heenreis',
    returnTrip: 'Terugreis',
    documents: 'Reisdocumenten',
    documentsText:
      'We hebben je reisbon en reisdocument als PDF bijgevoegd. Bewaar de documenten en check voor vertrek in bij de luchtvaartmaatschappij.',
    receipt: 'Reisbon',
    travelDocument: 'Reisdocument',
    keepEmail: 'Bewaar deze e-mail als ontvangstbewijs en boekingsbevestiging.',
    thanks: 'Bedankt voor je boeking bij BNO Travel.',
  },
  pl: {
    subject: 'Twoja podróż została potwierdzona',
    title: 'Twoja podróż została potwierdzona',
    greeting: 'Cześć',
    intro: 'Twoja rezerwacja lotu została utworzona.',
    bnoRef: 'Numer BNO',
    orderId: 'ID zamówienia Duffel',
    airline: 'Linia lotnicza',
    route: 'Trasa',
    outbound: 'Wylot',
    returnTrip: 'Powrót',
    documents: 'Dokumenty podróży',
    documentsText:
      'Dołączyliśmy potwierdzenie płatności i dokument podróży jako pliki PDF. Zachowaj dokumenty i odpraw się u linii lotniczej przed wylotem.',
    receipt: 'Potwierdzenie podróży',
    travelDocument: 'Dokument podróży',
    keepEmail: 'Zachowaj ten e-mail jako potwierdzenie rezerwacji.',
    thanks: 'Dziękujemy za rezerwację z BNO Travel.',
  },
  pt: {
    subject: 'A sua viagem está confirmada',
    title: 'A sua viagem está confirmada',
    greeting: 'Olá',
    intro: 'A sua reserva de voo foi criada com sucesso.',
    bnoRef: 'Referência BNO',
    orderId: 'ID da encomenda Duffel',
    airline: 'Companhia aérea',
    route: 'Rota',
    outbound: 'Ida',
    returnTrip: 'Regresso',
    documents: 'Documentos de viagem',
    documentsText:
      'Anexámos o recibo e o documento de viagem em PDF. Guarde os documentos e faça o check-in com a companhia aérea antes da partida.',
    receipt: 'Recibo de viagem',
    travelDocument: 'Documento de viagem',
    keepEmail: 'Guarde este e-mail como recibo e confirmação da reserva.',
    thanks: 'Obrigado por reservar com a BNO Travel.',
  },
};

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
  if (raw.startsWith('pt')) return 'pt';

  return 'en';
}

function getCopy(locale?: string | null): Copy {
  const normalized = normalizeLocale(locale);
  return COPY[normalized] || COPY.en;
}

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

function escapeHtml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safe(value: any, fallback = '-') {
  const str = String(value ?? '').trim();
  return str || fallback;
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
    pt: 'pt-PT',
    en: 'en-GB',
  };

  try {
    return new Intl.DateTimeFormat(localeMap[normalized] || 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return String(value);
  }
}

function getPassengerName(input: FlightEmailInput) {
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
  return full || safe(firstPassenger?.name, 'kunde');
}

function getOrderId(input: FlightEmailInput) {
  return input.orderId || input.order?.id || null;
}

function getAirline(input: FlightEmailInput) {
  return (
    input.airline ||
    input.order?.owner?.name ||
    input.offer?.owner?.name ||
    '-'
  );
}

function getRoute(input: FlightEmailInput) {
  const origin = input.origin || input.order?.slices?.[0]?.segments?.[0]?.origin?.iata_code || '-';

  const slices = Array.isArray(input.order?.slices)
    ? input.order.slices
    : Array.isArray(input.offer?.slices)
    ? input.offer.slices
    : [];

  const firstSlice = slices[0];
  const firstSegments = Array.isArray(firstSlice?.segments)
    ? firstSlice.segments
    : [];

  const lastOutboundSegment = firstSegments[firstSegments.length - 1];

  const destination =
    input.destination ||
    lastOutboundSegment?.destination?.iata_code ||
    lastOutboundSegment?.destination?.city_name ||
    '-';

  return `${origin} → ${destination}`;
}

function getOutboundDeparture(input: FlightEmailInput) {
  if (input.outboundDeparture) return input.outboundDeparture;

  const source = input.order || input.offer || {};
  return source?.slices?.[0]?.segments?.[0]?.departing_at || null;
}

function getOutboundArrival(input: FlightEmailInput) {
  if (input.outboundArrival) return input.outboundArrival;

  const source = input.order || input.offer || {};
  const segments = source?.slices?.[0]?.segments;
  if (Array.isArray(segments) && segments.length > 0) {
    return segments[segments.length - 1]?.arriving_at || null;
  }

  return null;
}

function getReturnDeparture(input: FlightEmailInput) {
  if (input.returnDeparture) return input.returnDeparture;

  const source = input.order || input.offer || {};
  return source?.slices?.[1]?.segments?.[0]?.departing_at || null;
}

function getReturnArrival(input: FlightEmailInput) {
  if (input.returnArrival) return input.returnArrival;

  const source = input.order || input.offer || {};
  const segments = source?.slices?.[1]?.segments;
  if (Array.isArray(segments) && segments.length > 0) {
    return segments[segments.length - 1]?.arriving_at || null;
  }

  return null;
}

function buildSubject(input: FlightEmailInput) {
  const copy = getCopy(input.locale);
  return `${copy.subject} ✈️ ${input.bnoBookingRef}`;
}

function buildHtml(input: FlightEmailInput) {
  const copy = getCopy(input.locale);
  const greetingName = getPassengerName(input);

  const outboundDeparture = getOutboundDeparture(input);
  const outboundArrival = getOutboundArrival(input);
  const returnDeparture = getReturnDeparture(input);
  const returnArrival = getReturnArrival(input);

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#0f172a; line-height:1.6; max-width:680px; margin:0 auto;">
      <h1 style="margin-bottom:8px; font-size:32px; line-height:1.2;">${escapeHtml(copy.title)} ✈️</h1>

      <p>${escapeHtml(copy.greeting)} ${escapeHtml(greetingName)},</p>
      <p>${escapeHtml(copy.intro)}</p>

      <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin:20px 0;">
        <p style="margin:0 0 8px 0;"><strong>${escapeHtml(copy.bnoRef)}:</strong> ${escapeHtml(input.bnoBookingRef)}</p>
        <p style="margin:0 0 8px 0;"><strong>${escapeHtml(copy.orderId)}:</strong> ${escapeHtml(safe(getOrderId(input)))}</p>
        <p style="margin:0 0 8px 0;"><strong>${escapeHtml(copy.airline)}:</strong> ${escapeHtml(getAirline(input))}</p>
        <p style="margin:0 0 8px 0;"><strong>${escapeHtml(copy.route)}:</strong> ${escapeHtml(getRoute(input))}</p>
        <p style="margin:0 0 8px 0;"><strong>${escapeHtml(copy.outbound)}:</strong> ${escapeHtml(formatDateTime(outboundDeparture, input.locale))} → ${escapeHtml(formatDateTime(outboundArrival, input.locale))}</p>
        <p style="margin:0;"><strong>${escapeHtml(copy.returnTrip)}:</strong> ${escapeHtml(formatDateTime(returnDeparture, input.locale))} → ${escapeHtml(formatDateTime(returnArrival, input.locale))}</p>
      </div>

      <div style="background:#ecfdf5; border:1px solid #bbf7d0; border-radius:12px; padding:16px; margin:20px 0;">
        <h2 style="font-size:18px; margin:0 0 8px 0; color:#047857;">${escapeHtml(copy.documents)}</h2>
        <p style="margin:0;">${escapeHtml(copy.documentsText)}</p>
        <ul style="margin:10px 0 0 18px; padding:0;">
          <li>${escapeHtml(copy.receipt)}</li>
          <li>${escapeHtml(copy.travelDocument)}</li>
        </ul>
      </div>

      <p>${escapeHtml(copy.keepEmail)}</p>
      <p>${escapeHtml(copy.thanks)}</p>
    </div>
  `;
}

function buildText(input: FlightEmailInput) {
  const copy = getCopy(input.locale);

  const outboundDeparture = getOutboundDeparture(input);
  const outboundArrival = getOutboundArrival(input);
  const returnDeparture = getReturnDeparture(input);
  const returnArrival = getReturnArrival(input);

  return [
    `${copy.title} ✈️`,
    '',
    `${copy.greeting} ${getPassengerName(input)},`,
    '',
    copy.intro,
    '',
    `${copy.bnoRef}: ${input.bnoBookingRef}`,
    `${copy.orderId}: ${safe(getOrderId(input))}`,
    `${copy.airline}: ${getAirline(input)}`,
    `${copy.route}: ${getRoute(input)}`,
    `${copy.outbound}: ${formatDateTime(outboundDeparture, input.locale)} -> ${formatDateTime(outboundArrival, input.locale)}`,
    `${copy.returnTrip}: ${formatDateTime(returnDeparture, input.locale)} -> ${formatDateTime(returnArrival, input.locale)}`,
    '',
    copy.documents,
    copy.documentsText,
    `- ${copy.receipt}`,
    `- ${copy.travelDocument}`,
    '',
    copy.keepEmail,
    copy.thanks,
  ].join('\n');
}

async function resolveAttachments(input: FlightEmailInput) {
  const explicitAttachments = Array.isArray(input.attachments)
    ? input.attachments
    : [];

  if (input.skipGeneratedDocuments) {
    return explicitAttachments;
  }

  try {
    const generated = await buildFlightDocumentAttachments({
      locale: input.locale,
      bnoBookingRef: input.bnoBookingRef,
      orderId: getOrderId(input),
      airline: getAirline(input),
      origin: input.origin,
      destination: input.destination,
      givenName: input.givenName,
      familyName: input.familyName,
      passengers: input.passengers,
      order: input.order,
      offer: input.offer,
      totalAmount: input.totalAmount,
      currency: input.currency,
      serviceFee: input.serviceFee,
      paymentBrand: input.paymentBrand,
      paymentLast4: input.paymentLast4,
    });

    return [...generated, ...explicitAttachments];
  } catch (error: any) {
    console.error('[FLIGHT EMAIL] failed to generate PDF documents', {
      message: error?.message || String(error),
      bnoBookingRef: input.bnoBookingRef,
      orderId: getOrderId(input),
    });

    return explicitAttachments;
  }
}

export async function sendFlightBookingConfirmationEmail(input: FlightEmailInput) {
  const resend = getResendClient();

  if (!input.to || !String(input.to).includes('@')) {
    throw new Error('Mangler gyldig mottakeradresse for bookingepost');
  }

  const attachments = await resolveAttachments(input);

  const response = await resend.emails.send({
    from: getEmailFrom(),
    to: [input.to],
    subject: buildSubject(input),
    html: buildHtml(input),
    text: buildText(input),
    replyTo: getReplyTo(),
    attachments: attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
    })),
  });

  if (response.error) {
    throw new Error(response.error.message || 'Kunne ikke sende e-post');
  }

  return response.data;
}