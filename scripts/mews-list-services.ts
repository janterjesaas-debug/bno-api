// scripts/mews-list-services.ts
import * as dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

async function main() {
  const baseUrl = (process.env.MEWS_BASE_URL || '').trim();
  const clientToken = (process.env.MEWS_CLIENT_TOKEN || '').trim();
  const accessToken = (process.env.MEWS_ACCESS_TOKEN || '').trim();
  const clientName = (process.env.MEWS_CLIENT_NAME || 'bno-api')
    .replace(/^"|"$/g, '')
    .trim();
  const enterpriseId = (process.env.MEWS_ENTERPRISE_ID || '').trim();
  const locale = (process.env.MEWS_LOCALE || 'en-US').trim();

  if (!baseUrl || !clientToken || !accessToken) {
    throw new Error(
      'Mangler MEWS_BASE_URL / MEWS_CLIENT_TOKEN / MEWS_ACCESS_TOKEN i .env',
    );
  }
  if (!enterpriseId) {
    throw new Error('Mangler MEWS_ENTERPRISE_ID i .env');
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/connector/v1/services/getAll`;

  const body = {
    ClientToken: clientToken,
    AccessToken: accessToken,
    Client: clientName,
    EnterpriseIds: [enterpriseId],
    Limitation: { Count: 100 }, // må være 1–1000
  };

  console.log('Henter services fra Mews...', url);

  const resp = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });

  const services = resp.data?.Services || [];
  console.log(`Fant ${services.length} service(r):\n`);

  for (const s of services) {
    const namesObj = s.Names || {};
    const nameFromLocale =
      (locale && namesObj[locale]) ||
      namesObj['en-US'] ||
      (Object.keys(namesObj).length
        ? namesObj[Object.keys(namesObj)[0]]
        : null) ||
      s.Name ||
      s.Id;

    console.log(`Id: ${s.Id}`);
    console.log(`  Navn: ${nameFromLocale}`);
    console.log(`  Names: ${JSON.stringify(namesObj)}`);
    console.log('');
  }

  console.log(
    'Kopier de ServiceId-ene du trenger inn i .env som MEWS_SERVICE_IDS (komma-separert), f.eks:',
  );
  console.log('MEWS_SERVICE_IDS=id1,id2,id3');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Feil i mews-list-services.ts:', err);
    process.exitCode = 1;
  });
}
