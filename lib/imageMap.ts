/* lib/imageMap.ts
   Oppdatert versjon med:
   - riktig Trysilbua-id
   - eget bildesett for Røde Kors
   - korrigert Røde Kors ground floor
   - gjenbrukte bildesett for flere Stranda-enheter
*/

const SB = "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images";

// --------------------------------------------------
// GJENBRUKBARE BILDESETT
// --------------------------------------------------

const IMG_STRANDA_98B = [
  `${SB}/Stranda%20Fjellgrend%2098B.jpg`,
  `${SB}/Stranda%20Fjellgrend%2098B%201.jpg`,
  `${SB}/Stranda%20Fjellgrend%2098B%202.jpg`,
  `${SB}/Stranda%20Fjellgrend%2098B%203.jpg`,
  `${SB}/Stranda%20Fjellgrend%2098B%204.jpg`,
  `${SB}/Stranda%20Fjellgrend%2098B%205.jpg`,
  `${SB}/Stranda%20Fjellgrend%2098B%206.png`,
];

const IMG_STRANDA_16A_3BED = [
  `${SB}/Stranda%20Fjellgrend%2016A.jpg`,
  `${SB}/Stranda%20Fjellgrend%2016A%201.jpg`,
  `${SB}/Stranda%20Fjellgrend%2016A%202.jpg`,
  `${SB}/Stranda%20Fjellgrend%2016A%203.jpg`,
  `${SB}/Stranda%20Fjellgrend%2016A%204.jpg`,
  `${SB}/Stranda%20Fjellgrend%2016A%205.jpg`,
  `${SB}/Stranda%20Fjellgrend%2016A%206.jpg`,
  `${SB}/Stranda%20Fjellgrend%2016A%207.jpg`,
  `${SB}/Stranda%20Fjellgrend%2016A%208.jpg`,
];

const IMG_STRANDA_32A = [...IMG_STRANDA_16A_3BED];

const IMG_STRANDA_68A = [
  `${SB}/Stranda%20Fjellgrend%203b2b%201.jpg`,
  `${SB}/Stranda%20Fjellgrend%203b2b%202.jpg`,
  `${SB}/Stranda%20Fjellgrend%203b2b%203.jpg`,
  `${SB}/Stranda%20Fjellgrend%203b2b%204.jpg`,
  `${SB}/Stranda%20Fjellgrend%203b2b%205.jpg`,
  `${SB}/Stranda%20Fjellgrend%203b2b%206.jpg`,
  `${SB}/Stranda%20Fjellgrend%203b2b%207.jpg`,
  `${SB}/Stranda%20Fjellgrend%203b2b%208.jpg`,
];

const IMG_STRANDA_F_SERIES = [
  `${SB}/Stranda%20F%201.jpg`,
  `${SB}/Stranda%20F%202.jpg`,
  `${SB}/Stranda%20F%203.jpg`,
  `${SB}/Stranda%20F%204.jpg`,
  `${SB}/Stranda%20F%205.jpg`,
  `${SB}/Stranda%20F%206.jpg`,
  `${SB}/Stranda%20F%207.png`,
];

const IMG_RODEKORS_GROUND_FLOOR = [
  `${SB}/Rode%20kors%20groud%20floor.jpg`,
  `${SB}/Rode%20kors%20groud%20floor%201.jpg`,
  `${SB}/Rode%20kors%20groud%20floor%202.jpg`,
  `${SB}/Rode%20kors%20groud%20floor%203.jpg`,
  `${SB}/Rode%20kors%20groud%20floor%204.jpg`,
  `${SB}/Rode%20kors%20groud%20floor%205.jpg`,
];

const IMG_RODEKORS = [
  `${SB}/rodekors%201.jpg`,
];

const IMG_TRYSILBUA = [
  `${SB}/trysilbua.jpg`,
  `${SB}/Trysilbua%201.jpg`,
  `${SB}/Trysilbua%202.jpg`,
  `${SB}/Trysilbua%203.jpg`,
  `${SB}/Trysilbua%204.jpg`,
  `${SB}/Trysilbua%205.jpg`,
  `${SB}/Trysilbua%206.jpg`,
  `${SB}/Trysilbua%207.jpg`,
  `${SB}/Trysilbua%208.jpg`,
  `${SB}/Trysilbua%209.jpg`,
];

const IMG_STRANDA_80C = [
  `${SB}/Stranda%20Fjellgrend%2080C%201.jpg`,
  `${SB}/Stranda%20Fjellgrend%2080C%202.jpg`,
  `${SB}/Stranda%20Fjellgrend%2080C%203.jpg`,
  `${SB}/Stranda%20Fjellgrend%2080C%204.jpg`,
  `${SB}/Stranda%20Fjellgrend%2080C%205.jpg`,
  `${SB}/Stranda%20Fjellgrend%2080C%206.jpg`,
  `${SB}/Stranda%20Fjellgrend%2080C%207.jpg`,
  `${SB}/Stranda%20Fjellgrend%2080C%208.jpg`,
  `${SB}/Stranda%20Fjellgrend%2080C%209.jpg`,
];

// --------------------------------------------------
// MAP
// --------------------------------------------------

export const RESOURCE_CATEGORY_IMAGES: Record<string, string[]> = {
  // Fagerhøy 1181
  "7b6a63f0-f035-4248-8caf-b31b00c7b029": [
    `${SB}/Fagerhoy2-01.jpg`,
    `${SB}/Fagerhoy2-02.jpg`,
    `${SB}/Fagerhoy2-03.jpg`,
    `${SB}/Fagerhoy2-04.jpg`,
    `${SB}/Fagerhoy2-05.jpg`,
    `${SB}/Fagerhoy2-06.jpg`,
    `${SB}/Fagerhoy2-07.jpg`,
    `${SB}/Fagerhoy2-08.jpg`,
    `${SB}/Fagerhoy2-09.jpg`,
    `${SB}/Fagerhoy2-10.jpg`,
  ],

  // Litunet 721B
  "c5d45a72-6f11-4a3a-9b78-b32c00a3c09b": [
    `${SB}/Litunet721b_1.jpg`,
    `${SB}/Litunet721b_2.jpg`,
    `${SB}/Litunet721b_3.jpg`,
    `${SB}/Litunet721b_4.jpg`,
    `${SB}/Litunet721b_5.jpg`,
    `${SB}/Litunet721b_6.jpg`,
    `${SB}/Litunet721b_7.jpg`,
    `${SB}/Litunet721b_8.jpg`,
    `${SB}/Litunet721b_9.jpg`,
    `${SB}/Litunet721b_10.jpg`,
    `${SB}/Litunet721b_11.jpg`,
    `${SB}/Litunet721b_12.jpg`,
    `${SB}/Litunet%20ski%20in%20ski%20out%20bakke%2013.jpg`,
  ],

  // Ugla 917
  "06160e45-0a97-401c-889c-b32c00a4bb64": [
    `${SB}/Ugla%20917%201.jpg`,
    `${SB}/Ugla%20917%202.jpg`,
    `${SB}/Ugla%20917%203.jpg`,
    `${SB}/Ugla%20917%204.jpg`,
    `${SB}/Ugla%20917%205.jpg`,
    `${SB}/Ugla%20917%206.jpg`,
    `${SB}/Ugla%20917%207.jpg`,
    `${SB}/Ugla%20917%208.jpg`,
    `${SB}/Ugla%20917%209.jpg`,
    `${SB}/Ugla%20917%2010.jpg`,
    `${SB}/Ugla%20917%2011.jpg`,
    `${SB}/Ugla%20917%2012.jpg`,
    `${SB}/Ugla%20917%2013.jpg`,
    `${SB}/Ugla%20917%2014.jpg`,
  ],

  // Vestsidevegen 14
  "35f40983-7045-409a-a0ae-b3bb00ba99fc": [
    `${SB}/Vestsidevegen%201.jpg`,
    `${SB}/Vestsidevegen%202.jpg`,
    `${SB}/Vestsidevegen%203.jpg`,
    `${SB}/Vestsidevegen%204.jpg`,
    `${SB}/Vestsidevegen%205.jpg`,
    `${SB}/Vestsidevegen%206.jpg`,
    `${SB}/Vestsidevegen%207.jpg`,
    `${SB}/Vestsidevegen%208.jpg`,
    `${SB}/Vestsidevegen%209.jpg`,
    `${SB}/Vestsidevegen%2010.jpg`,
    `${SB}/Vestsidevegen%2011.jpg`,
    `${SB}/Vestsidevegen%2012.jpg`,
    `${SB}/Vestsidevegen%2013.jpg`,
    `${SB}/Vestsidevegen%2014.jpg`,
    `${SB}/Vestsidevegen%2015.jpg`,
  ],

  // Tandådalen Sälen
  "e2add613-9f83-4acc-abef-b32c00a74bd9": [
    `${SB}/Demo%203.jpg`,
  ],

  // Högfjället Sälen
  "25859550-3b6b-424b-8eb5-b32c00a70c07": [
    `${SB}/Demo%202.jpg`,
  ],

  // Lindvallen Sälen
  "2f5505b5-3b94-4b03-a4ca-b32c00a6c1c0": [
    `${SB}/Demo%204.jpg`,
  ],

  // Chalet Strandafjellet
  "a0b4d9a2-266c-40af-b4ba-b15a007ef02f": [
    `${SB}/chalet%20strandafjellet.jpg`,
    `${SB}/chalet%20strandafjellet%201.jpg`,
    `${SB}/chalet%20strandafjellet%202.jpg`,
    `${SB}/chalet%20strandafjellet%203.jpg`,
    `${SB}/chalet%20strandafjellet%204.jpg`,
    `${SB}/chalet%20strandafjellet%205.jpg`,
    `${SB}/chalet%20strandafjellet%206.jpg`,
    `${SB}/chalet%20strandafjellet%207.jpg`,
    `${SB}/chalet%20strandafjellet%208.jpg`,
    `${SB}/chalet%20strandafjellet%209.jpg`,
    `${SB}/chalet%20strandafjellet%2010.jpg`,
    `${SB}/chalet%20strandafjellet%2011.jpg`,
    `${SB}/chalet%20strandafjellet%2012.jpg`,
    `${SB}/chalet%20strandafjellet%2013.jpg`,
    `${SB}/chalet%20strandafjellet%2014.jpg`,
    `${SB}/chalet%20strandafjellet%2015.jpg`,
  ],

  // Strandafjellet Mountain Lodge
  "2f1beca3-adb9-47ae-aa85-b15a007ef02f": [
    `${SB}/Mountain-Lodge-Strandafjellet.jpg`,
    `${SB}/Mountain-Lodge-Strandafjellet1.jpg`,
  ],

  // Fjord Panorama
  "07698215-18e7-454d-b4cf-b15a007ef02f": [
    `${SB}/Fjord%20Panorama.jpg`,
    `${SB}/Fjord%20Panorama%201.jpg`,
    `${SB}/Fjord%20Panorama%202.jpg`,
    `${SB}/Fjord%20Panorama%203.jpg`,
    `${SB}/Fjord%20Panorama%204.jpg`,
    `${SB}/Fjord%20Panorama%205.jpg`,
    `${SB}/Fjord%20Panorama%206.jpg`,
    `${SB}/Fjord%20Panorama%207.jpg`,
    `${SB}/Fjord%20Panorama%208.jpg`,
    `${SB}/Fjord%20Panorama%209.jpg`,
  ],

  // Rorbu
  "34993a51-69ec-469e-bb25-b1950040d184": [
    `${SB}/Rorbu.jpg`,
    `${SB}/Rorbu%201.jpg`,
    `${SB}/Rorbu%202.jpg`,
    `${SB}/Rorbu%203.jpg`,
    `${SB}/Rorbu%204.jpg`,
    `${SB}/Rorbu%205.jpg`,
    `${SB}/Rorbu%206.jpg`,
    `${SB}/Rorbu%207.jpg`,
    `${SB}/Rorbu.jpg`,
  ],

  // Riverside
  "4d9807a9-8542-4116-ae06-b15a007ef02f": [
    `${SB}/riverside.jpg`,
  ],

  // Mountain View Logde
  "6fdf8c50-f57c-49de-afc1-b2b300e88a09": [
    `${SB}/Mountain%20View%20Logde.jpg`,
    `${SB}/mountain%20View%20Logde%201.png`,
    `${SB}/mountain%20View%20Logde%202.png`,
  ],

  // Koie Deluxe I
  "51cff127-0eb2-4e59-bdaf-b16e0144b672": [
    `${SB}/Koie%20Deluxe%20I.jpg`,
    `${SB}/Koie%20deluxe%201.jpg`,
    `${SB}/Koie%20Deluxe%202.jpg`,
    `${SB}/Koie%20Deluxe%203.jpg`,
    `${SB}/Koie%20Deluxe%204.jpg`,
    `${SB}/Koie%20Deluxe%205.jpg`,
    `${SB}/Koie%20Deluxe%206.jpg`,
    `${SB}/Koie%20Deluxe%207.jpg`,
  ],

  // Koie Deluxe II
  "acc74eff-22fc-4f37-9dd6-b15a007ef02f": [
    `${SB}/Koie%20deluxe%20II.jpg`,
    `${SB}/Koie%20Deluxe%20II%200.jpg`,
    `${SB}/Koie%20Deluxe%20II%201.jpg`,
    `${SB}/Koie%20Deluxe%20II%202.jpg`,
    `${SB}/Koie%20Deluxe%20II%203.jpg`,
    `${SB}/Koie%20Deluxe%20II%204.jpg`,
    `${SB}/Koie%20Deluxe%20II%205.jpg`,
    `${SB}/Koie%20Deluxe%20II%206.jpg`,
  ],

  // Sjåfram
  "4e690c24-dcd4-4fc7-b672-b15a007ef02f": [
    `${SB}/Sjaafram.jpg`,
    `${SB}/Sjaafram%201.jpg`,
    `${SB}/Sjaafram%202.jpg`,
    `${SB}/Sjaafram%203.jpg`,
    `${SB}/Sjaafram%204.jpg`,
    `${SB}/Sjaafram%205.jpg`,
    `${SB}/Sjaafram%206.jpg`,
    `${SB}/Sjaafram%207.jpg`,
    `${SB}/Sjaafram%208.jpg`,
    `${SB}/Sjaafram%209.jpg`,
  ],

  // Tiny Mountain Cabin II
  "3a0f4243-1775-4990-874f-b1950043000f": [
    `${SB}/Tiny%20Mountain%20Cabin%20II%201.jpg`,
    `${SB}/Tiny%20Mountain%20Cabin%20II%202.jpg`,
    `${SB}/Tiny%20Mountain%20Cabin%20II%203.jpg`,
    `${SB}/Tiny%20Mountain%20Cabin%20II%204.jpg`,
    `${SB}/Tiny%20Mountain%20Cabin%20II%205.jpg`,
    `${SB}/Tiny%20Mountain%20Cabin%20II%206.jpg`,
    `${SB}/Tiny%20Mountain%20Cabin%20II%207.jpg`,
    `${SB}/Tiny%20Mountain%20Cabin%20II%208.jpg`,
    `${SB}/Tiny%20Mountain%20Cabin%20II%209.jpg`,
    `${SB}/Tiny%20Mountain%20Cabin%20II%2010.jpg`,
    `${SB}/Tiny%20Mountain%20Cabin%20II%2011.jpg`,
  ],

  // Øklevegen 2 / Økslevegen 2
  "80818c3f-2573-4494-8ba3-b15a007ef02f": [
    `${SB}/Okslevegen%202.jpg`,
    `${SB}/Okslevegen%202%201.jpg`,
    `${SB}/Okslevegen%202%202.jpg`,
    `${SB}/Okslevegen%202%203.jpg`,
    `${SB}/Okslevegen%202%204.jpg`,
    `${SB}/Okslevegen%202%205.jpg`,
    `${SB}/Okslevegen%202%206.jpg`,
    `${SB}/Okslevegen%202%207.jpg`,
    `${SB}/Okslevegen%202%208.jpg`,
    `${SB}/Okslevegen%202%209.jpg`,
    `${SB}/Okslevegen%202%2010.jpg`,
    `${SB}/Okslevegen%202%2011.jpg`,
  ],

  // Fjellsætra Alpegrend
  "b47530da-4028-42a1-a17e-b15a007ef02f": [
    `${SB}/Fjellsetra%20Alpegrend.jpg`,
    `${SB}/Fjellsetra%20Alpegrend%201.jpg`,
    `${SB}/Fjellsetra%20Alpegrend%202.jpg`,
    `${SB}/Fjellsetra%20Alpegrend%203.jpg`,
    `${SB}/Fjellsetra%20Alpegrend%204.jpg`,
    `${SB}/Fjellsetra%20Alpegrend%205.jpg`,
    `${SB}/Fjellsetra%20Alpegrend%206.jpg`,
    `${SB}/Fjellsetra%20Alpegrend%207.jpg`,
  ],

  // Utsikten
  "894b0878-441f-4c11-a807-b15a007ef02f": [
    `${SB}/Utsikten.jpg`,
    `${SB}/Utsikten%201.jpg`,
    `${SB}/Utsikten%202.jpg`,
    `${SB}/Utsikten%203.jpg`,
    `${SB}/Utsikten%204.jpg`,
    `${SB}/Utsikten%205.jpg`,
    `${SB}/Utsikten%206.jpg`,
    `${SB}/Utsikten%207.jpg`,
    `${SB}/Utsikten%208.jpg`,
    `${SB}/Utsikten%209.jpg`,
    `${SB}/Utsikten%2010.jpg`,
    `${SB}/Utsikten%2011.jpg`,
  ],

  // Harevadet 211
  "abb1a8e2-ceee-4edc-aa75-b15a007ef02f": [
    `${SB}/Harevadet%20211.jpg`,
    `${SB}/Harevadet%20211%201.jpg`,
    `${SB}/Harevadet%20211%202.jpg`,
    `${SB}/Harevadet%20211%203.jpg`,
    `${SB}/Harevadet%20211%204.jpg`,
    `${SB}/Harevadet%20211%205.jpg`,
    `${SB}/Harevadet%20211%206.jpg`,
    `${SB}/Harevadet%20211%207.jpg`,
    `${SB}/Harevadet%20211%208.jpg`,
    `${SB}/Harevadet%20211%209.jpg`,
    `${SB}/Harevadet%20211%2010.jpg`,
    `${SB}/Harevadet%20211%2011.jpg`,
    `${SB}/Harevadet%20211%2012.jpg`,
    `${SB}/Harevadet%20211%2013.jpg`,
  ],

  // Lake View Apartment B4/L3
  "a713bf60-4d87-41ab-812c-b15a007ef02f": [
    `${SB}/Lake%20View%20Apartment%20B4L3.jpg`,
    `${SB}/Lake%20View%20Apartment%20B4L3%201.jpg`,
    `${SB}/Lake%20View%20Apartment%20B4L3%202.jpg`,
    `${SB}/Lake%20View%20Apartment%20B4L3%203.jpg`,
    `${SB}/Lake%20View%20Apartment%20B4L3%204.jpg`,
    `${SB}/Lake%20View%20Apartment%20B4L3%205.jpg`,
    `${SB}/Lake%20View%20Apartment%20B4L3%206.jpg`,
    `${SB}/Lake%20View%20Apartment%20B4L3%207.jpg`,
  ],

  // Lake View Apartment B5/L6
  "4b5d7e45-3515-4076-87cc-b15a007ef02f": [
    `${SB}/Lake%20View%20Apartment%20B5L6.jpg`,
    `${SB}/Lake%20View%20Apartment%20B5L6%201.jpg`,
    `${SB}/Lake%20View%20Apartment%20B5L6%202.jpg`,
    `${SB}/Lake%20View%20Apartment%20B5L6%203.jpg`,
    `${SB}/Lake%20View%20Apartment%20B5L6%204.jpg`,
    `${SB}/Lake%20View%20Apartment%20B5L6%205.jpg`,
    `${SB}/Lake%20View%20Apartment%20B5L6%206.jpg`,
    `${SB}/Lake%20View%20Apartment%20B5L6%207.jpg`,
    `${SB}/Lake%20View%20Apartment%20B5L6%208.jpg`,
    `${SB}/Lake%20View%20Apartment%20B5L6%209.jpg`,
  ],

  // Lastølen B9/N2
  "6ddde6fb-48f1-485b-bfbd-b220011453e9": [
    `${SB}/Lastolen.jpg`,
    `${SB}/Lastolen%201.jpg`,
    `${SB}/Lastolen%202.jpg`,
    `${SB}/Lastolen%203.jpg`,
    `${SB}/Lastolen%204.jpg`,
  ],

  // Lastølen B5/S2
  "c2530b78-8c5b-4fc8-b39f-b22001158262": [
    `${SB}/Lastolen%203s%20.jpg`,
    `${SB}/Lastolen%203s%201.jpg`,
    `${SB}/Lastolen%203s%202.jpg`,
    `${SB}/Lastolen%203s%203.jpg`,
    `${SB}/Lastolen%203s%204.jpg`,
    `${SB}/Lastolen%203s%205.jpg`,
    `${SB}/Lastolen%203s%206.jpg`,
    `${SB}/Lastolen%203s%207.jpg`,
    `${SB}/Lastolen%203s%208.jpg`,
    `${SB}/Lastolen%203s%209.jpg`,
  ],

  // Røde Kors
  "04e0d66c-1c9f-4168-857b-b15a007ef02f": IMG_RODEKORS,

  // Røde Kors ground floor
  "867c3e6f-7646-4240-84c4-b15a007ef02f": IMG_RODEKORS_GROUND_FLOOR,

  // Koie Family
  "a6117fdf-342b-457b-b0b9-b15a007ef02f": [
    `${SB}/Koie%20Family.jpg`,
    `${SB}/Koie%20Family%201.jpg`,
    `${SB}/Koie%20Family%202.jpg`,
    `${SB}/Koie%20Family%203.jpg`,
    `${SB}/Koie%20Family%204.jpg`,
    `${SB}/Koie%20Family%205.jpg`,
    `${SB}/Koie%20Family%206.jpg`,
  ],

  // Koie Smart
  "6bfa07e2-85ae-40b5-9e62-b15a007ef02f": [
    `${SB}/koie%20smart.jpg`,
    `${SB}/Koie%20Smart%201.jpg`,
    `${SB}/Koie%20Smart%202.jpg`,
    `${SB}/Koie%20Smart%203.jpg`,
    `${SB}/Koie%20Smart%204.jpg`,
    `${SB}/Koie%20Smart%205.jpg`,
    `${SB}/Koie%20Smart%206.jpg`,
  ],

  // Koie Standard
  "22375a4b-751e-41df-ad35-b15a007ef02f": [
    `${SB}/Koie%20standard.jpg`,
    `${SB}/Koie%20Standard%201.jpg`,
    `${SB}/Koie%20Standard%202.jpg`,
    `${SB}/Koie%20Standard%203.jpg`,
    `${SB}/Koie%20Standard%204.jpg`,
    `${SB}/Koie%20Standard%205.jpg`,
    `${SB}/Koie%20Standard%206.jpg`,
    `${SB}/Koie%20Standard%207.jpg`,
    `${SB}/Koie%20Standard%208.jpg`,
  ],

  // Koie Holiday Home 3
  "ed46726e-e7b7-4372-a23f-b15a007ef02f": [
    `${SB}/Koie%20Holiday%20Home%203.jpg`,
    `${SB}/Koie%20Holiday%20Home%203%201.jpg`,
    `${SB}/Koie%20Holiday%20Home%203%202.jpg`,
    `${SB}/Koie%20Holiday%20Home%203%203.jpg`,
    `${SB}/Koie%20Holiday%20Home%203%204.jpg`,
    `${SB}/Koie%20Holiday%20Home%203%205.jpg`,
    `${SB}/Koie%20Holiday%20Home%203%206.jpg`,
    `${SB}/Koie%20Holiday%20Home%203%207.jpg`,
    `${SB}/Koie%20Holiday%20Home%203%208.jpg`,
  ],

  // Mountain View Apartments 304
  "f4094e42-219b-40a4-b839-b1950042b19e": [
    `${SB}/Mountain%20View%20Apartments%20304.jpg`,
    `${SB}/Mountain%20View%20Apartments%20304%201.jpg`,
    `${SB}/Mountain%20View%20Apartments%20304%201a.jpg`,
    `${SB}/Mountain%20View%20Apartments%20304%202.jpg`,
    `${SB}/Mountain%20View%20Apartments%20304%203.jpg`,
    `${SB}/Mountain%20View%20Apartments%20304%204.jpg`,
    `${SB}/Mountain%20View%20Apartments%20304%205.jpg`,
    `${SB}/Mountain%20View%20Apartments%20304%206.jpg`,
    `${SB}/Mountain%20View%20Apartments%20304%207.jpg`,
    `${SB}/Mountain%20View%20Apartments%20304%208.jpg`,
    `${SB}/Mountain%20View%20Apartments%20304%209.jpg`,
    `${SB}/Mountain%20View%20Apartments%20304%2010.jpg`,
    `${SB}/Mountain%20View%20Apartments%20304%2011.jpg`,
    `${SB}/Mountain%20View%20Apartments%20304%2012.jpg`,
    `${SB}/Mountain%20View%20Apartments%20304%2013.jpg`,
  ],

  // Mountain View Apartments 205
  "072be395-785f-4b0e-bcc4-b18000cd2855": [
    `${SB}/Mountain%20View%20Apartments%20205.jpg`,
    `${SB}/Mountain%20View%20Apartments%20205%201.jpg`,
    `${SB}/Mountain%20View%20Apartments%20205%202.jpg`,
    `${SB}/Mountain%20View%20Apartments%20205%203.jpg`,
    `${SB}/Mountain%20View%20Apartments%20205%204.jpg`,
    `${SB}/Mountain%20View%20Apartments%20205%205.jpg`,
    `${SB}/Mountain%20View%20Apartments%20205%206.jpg`,
    `${SB}/Mountain%20View%20Apartments%20205%207.jpg`,
    `${SB}/Mountain%20View%20Apartments%20205%208.jpg`,
  ],

  // Mountain View Apartments 102
  "5bd7be93-f889-467b-8189-b1950042046f": [
    `${SB}/Mountain%20View%20Apartments%20102%20a.jpg`,
    `${SB}/Mountain%20View%20Apartments%20102.jpg`,
    `${SB}/Mountain%20View%20Apartments%20102%201.jpg`,
    `${SB}/Mountain%20View%20Apartments%20102%202.jpg`,
    `${SB}/Mountain%20View%20Apartments%20102%203.jpg`,
    `${SB}/Mountain%20View%20Apartments%20102%204.jpg`,
    `${SB}/Mountain%20View%20Apartments%20102%205.jpg`,
    `${SB}/Mountain%20View%20Apartments%20102%206.jpg`,
    `${SB}/Mountain%20View%20Apartments%20102%207.jpg`,
  ],

  // Mountain View Apartments 301
  "96f2f0c7-feb0-4526-945f-b3ad00a5739f": [
    `${SB}/Mountain%20View%20Apartments%20301.jpg`,
  ],

  // Mountain View Apartments 203
  "a7a5b9ce-caa6-4dd7-9e7a-b2ab0165b9f6": [
    `${SB}/Mountain%20View%20Apartments%20203.jpg`,
  ],

  // Stranda Fjellgrend 42B
  "ac18e5f6-6c88-4a01-a1db-b2ad0137d6b5": [
    `${SB}/1%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg`,
    `${SB}/2%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg`,
    `${SB}/3%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg`,
    `${SB}/4%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg`,
    `${SB}/5%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg`,
    `${SB}/6%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg`,
    `${SB}/7%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg`,
    `${SB}/8%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg`,
    `${SB}/9%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg`,
  ],

  // Stranda Fjellgrend 46A
  "4c37ce32-956f-4b7a-95f5-b2e20139d9e3": [
    `${SB}/stranda%20fjellgrend%203%20soverom.jpg`,
    `${SB}/Stranda%20Fjellgrend%2046A%201.jpg`,
    `${SB}/Stranda%20Fjellgrend%2046A%202.jpg`,
    `${SB}/Stranda%20Fjellgrend%2046A%203.jpg`,
    `${SB}/Stranda%20Fjellgrend%2046A%204.jpg`,
    `${SB}/Stranda%20Fjellgrend%2046A%205.png`,
    `${SB}/Stranda%20Fjellgrend%2046A%206.png`,
    `${SB}/Stranda%20Fjellgrend%2046A%207.png`,
  ],

  // Stranda Fjellgrend 16A
  "94744891-65a9-46cb-958b-b2e2013a2b68": IMG_STRANDA_16A_3BED,

  // Stranda Fjellgrend 98B
  "a8301687-1af8-4ea4-9ce0-b2e20145e011": IMG_STRANDA_98B,

  // Skarhaug Panorama Lodge
  "503a9fb6-db71-4a5f-b879-b3df00d249a9": [
    `${SB}/Skarhaug%20Panorama%20Lodge%201.jpg`,
    `${SB}/Skarhaug%20Panorama%20Lodge%202.jpg`,
    `${SB}/Skarhaug%20Panorama%20Lodge%203.jpg`,
    `${SB}/Skarhaug%20Panorama%20Lodge%204.jpg`,
    `${SB}/Skarhaug%20Panorama%20Lodge%205.jpg`,
    `${SB}/Skarhaug%20Panorama%20Lodge%206.jpg`,
    `${SB}/Skarhaug%20Panorama%20Lodge%207.jpg`,
    `${SB}/Skarhaug%20Panorama%20Lodge%208.jpg`,
    `${SB}/Skarhaug%20Panorama%20Lodge%209.jpg`,
    `${SB}/Skarhaug%20Panorama%20Lodge%2010.jpg`,
    `${SB}/Skarhaug%20Panorama%20Lodge%2011.jpg`,
  ],

  // Mountain View Apartment 201
  "57011669-35e7-4ac9-8f76-b3e100d7f92e": [
    `${SB}/Mountain%20View%20Apartment%20201%201.jpg`,
    `${SB}/Mountain%20View%20Apartment%20201%202.jpg`,
    `${SB}/Mountain%20View%20Apartment%20201%203.jpg`,
    `${SB}/Mountain%20View%20Apartment%20201%204.jpg`,
    `${SB}/Mountain%20View%20Apartment%20201%205.jpg`,
    `${SB}/Mountain%20View%20Apartment%20201%206.jpg`,
    `${SB}/Mountain%20View%20Apartment%20201%207.jpg`,
    `${SB}/Mountain%20View%20Apartment%20201%208.jpg`,
    `${SB}/Mountain%20View%20Apartment%20201%209.jpg`,
  ],

  // Stranda Fjellgrend 14A
  "da95b306-10a2-4a04-8010-b15a007ef02f": [
    `${SB}/Stranda%20Fjellgrend%2014A%201.jpg`,
    `${SB}/Stranda%20Fjellgrend%2014A%202.jpg`,
    `${SB}/Stranda%20Fjellgrend%2014A%203.jpg`,
    `${SB}/Stranda%20Fjellgrend%2014A%204.jpg`,
    `${SB}/Stranda%20Fjellgrend%2014A%205.jpg`,
    `${SB}/Stranda%20Fjellgrend%2014A%206.jpg`,
    `${SB}/Stranda%20Fjellgrend%2014A%207.jpg`,
    `${SB}/Stranda%20Fjellgrend%2014A%208.jpg`,
    `${SB}/Stranda%20Fjellgrend%2014A%209.jpg`,
    `${SB}/Stranda%20Fjellgrend%2014A%2010.jpg`,
    `${SB}/Stranda%20Fjellgrend%2014A%2011.jpg`,
  ],

  // Stranda Fjellgrend 50A
  "7f9787f5-fd52-4ac6-bbbc-b1fd0149aa91": IMG_STRANDA_F_SERIES,

  // Stranda Fjellgrend 64A
  "84cecb52-8c0d-40d3-add6-b1fd0149be97": IMG_STRANDA_F_SERIES,

  // Stranda Fjellgrend 76B
  "7f06b9a5-9306-42b4-a2d8-b1fd014a15fc": IMG_STRANDA_F_SERIES,

  // Stranda Fjellgrend 16B
  "e210d1cc-0f05-44bf-8f93-b15a007ef02f": IMG_STRANDA_98B,

  // Stranda Fjellgrend 24B
  "7ccdf353-6e3c-4c80-9a85-b2200101d802": IMG_STRANDA_98B,

  // Stranda Fjellgrend 29C
  "bbba53c2-6ea3-48b2-914b-b309005f634d": IMG_STRANDA_98B,

  // Stranda Fjellgrend 30B
  "3a4accd0-3fa4-4f76-9c58-b1fe007f0f2d": IMG_STRANDA_98B,

  // Stranda Fjellgrend 32B
  "8f0f3f35-8d0f-450f-94d3-b2200102131d": IMG_STRANDA_98B,

  // Stranda Fjellgrend 14B
  "b92f07ae-6e35-4673-b510-b1fe007ec8d8": IMG_STRANDA_98B,

  // Stranda Fjellgrend 31D
  "eb8791bf-154c-4a43-bf7f-b2200101f2f1": IMG_STRANDA_98B,

  // Stranda Fjellgrend 36B
  "7faa5b6a-b932-4c8b-84a1-b220011a208b": IMG_STRANDA_98B,

  // Stranda Fjellgrend 24A
  "b9ffaad9-33ce-41a6-99e9-b1fe007f6bf3": IMG_STRANDA_16A_3BED,

  // Stranda Fjellgrend 30A
  "078c0ded-070b-4549-9888-b2200102d754": IMG_STRANDA_16A_3BED,

  // Stranda Fjellgrend 12A
  "f562e533-1f85-4aeb-a92f-b1fe007f2f5a": IMG_STRANDA_16A_3BED,

  // Stranda Fjellgrend 20A
  "cb1926a5-359d-4852-8f0c-b22001028f86": IMG_STRANDA_16A_3BED,

  // Stranda Fjellgrend 32A
  "8b70ecf1-22c8-483e-978b-b22001032d04": IMG_STRANDA_32A,

  // Stranda Fjellgrend 36A
  "3ecdc463-cb28-406e-b861-b22001038a3e": IMG_STRANDA_32A,

  // Stranda Fjellgrend 38A
  "cd7f1c5d-f955-4833-a763-b2200103a395": IMG_STRANDA_32A,

  // Stranda Fjellgrend 44A
  "3fde86d5-5647-42fe-9787-b22001051a85": IMG_STRANDA_32A,

  // Stranda Fjellgrend 44B
  "88660a5f-6180-48bb-a0d8-b22001052d76": IMG_STRANDA_32A,

  // Stranda Fjellgrend 80A
  "f9005eee-bb8f-47e4-b658-b22001059b2d": IMG_STRANDA_32A,

  // Stranda Fjellgrend 80B
  "455a479a-9a9e-4834-bd7f-b2200105b011": IMG_STRANDA_32A,

  // Stranda Fjellgrend 82A
  "e3710ff1-4335-4b55-a431-b2200101b325": IMG_STRANDA_32A,

  // Stranda Fjellgrend 98A
  "66c7e731-9823-45b5-a1ef-b15a007ef02f": IMG_STRANDA_32A,

  // Koie Camper
  "75d3db44-45a1-4310-9cbe-b15a007ef02f": [
    `${SB}/koie%20camper.jpg`,
  ],

  // Koie Caravan
  "32324f93-8942-413b-a515-b15a007ef02f": [
    `${SB}/Koie%20caravan.jpg`,
  ],

  // Koie Tent
  "732d4795-81c8-48e3-ba22-b15a007ef02f": [
    `${SB}/Koie%20caravan.jpg`,
  ],

  // Bergebu
  "aab5a0a1-6743-41d3-b641-b15a007ef02f": [
    `${SB}/Bergebu.jpg`,
  ],

  // Gladheim
  "1ba03370-240f-4a73-b5c3-b15a007ef02f": [
    `${SB}/Gladheim.jpg`,
  ],

  // Langlofonna
  "8a302964-b83b-445b-973e-b15a007ef02f": [
    `${SB}/Langlofonna.jpg`,
  ],

  // Lykkeli
  "fb1f637a-8e13-46a4-83b0-b15a007ef02f": [
    `${SB}/Lykkeli.jpg`,
  ],

  // Tiny Mountain Cabin I
  "878b1d23-6c85-4a20-8ee5-b1630119d6b9": [
    `${SB}/Tiny%201.jpg`,
  ],

  // Valley View
  "d183bf9f-0e26-4147-b341-b15a007ef02f": [
    `${SB}/Valley%20View.jpg`,
  ],

  // Harevadet 78
  "d176e9f4-ecd6-46bc-990e-b16300e9d3fb": [
    `${SB}/harevadet%2078.jpg`,
  ],

  // Lake View Apartment B5/L5
  "f8bd976f-908a-4a36-a10b-b15a007ef02f": [
    `${SB}/lake%20View%20Apartment%204%20soverom%202%20bad.jpg`,
  ],

  // Lastølen B10/S1
  "b35b8c52-35ec-482d-aa20-b15a007ef02f": [
    `${SB}/Lastolen.jpg`,
  ],

  // Koie Holiday Home 25
  "65bf8027-f03d-4a2c-8ea4-b1be0089a061": [
    `${SB}/koie%2025.jpg`,
  ],

  // Mountain View Apartments 103
  "bb96a008-eeef-4c82-bda1-b29e013c2106": [
    `${SB}/Mountain%20View%20Apartments%20103.jpg`,
  ],

  // Stranda Fjellgrend 35C
  "2e9c5ee7-ce70-4d66-b989-b1fd01497063": IMG_STRANDA_F_SERIES,

  // Stranda Fjellgrend 72A
  "402fbc75-067a-4b1b-90f7-b1fd0149e5a3": IMG_STRANDA_F_SERIES,

  // Stranda Fjellgrend 78A
  "ace31d40-13b3-4b3c-89fb-b1fd014a2f71": IMG_STRANDA_F_SERIES,

  // Stranda Fjellgrend 68A
  "40d58bdf-78cb-4b0a-8088-b220010720e6": IMG_STRANDA_68A,

  // Stranda Fjellgrend 68B
  "64f8ee64-43e4-48df-87b7-b22001073aa6": IMG_STRANDA_68A,

  // Stranda Fjellgrend 60A
  "b44d6081-54d8-4788-9b5b-b15a007ef02f": IMG_STRANDA_68A,

  // Stranda Fjellgrend 60B
  "4d02e4e0-20e9-40f9-a061-b15a007ef02f": IMG_STRANDA_68A,

  // Stranda Fjellgrend 80C
  "b6bd8814-9bf2-49f2-a8f2-b15a007ef02f": IMG_STRANDA_80C,

  // Stranda Fjellgrend 80D
  "e4866909-615d-4052-80dd-b22001066f15": IMG_STRANDA_80C,

  // Trysilbua - riktig id
  "4fe51ca8-6e53-4cbe-bdfb-b3f30090fc10": IMG_TRYSILBUA,

  // Beholdt gamle Trysilbua-id for bakoverkompatibilitet hvis den fortsatt brukes et sted
  "bd06103f-184b-4e18-b522-b3f30094beb6": IMG_TRYSILBUA,
};

// Beholdt for kompatibilitet
export const RESOURCE_CATEGORY_IMAGES_ALL: Record<string, string[]> = {
  ...RESOURCE_CATEGORY_IMAGES,
};

export function getImagesForResourceCategory(id?: string | null): string[] {
  if (!id) return [];
  return RESOURCE_CATEGORY_IMAGES_ALL[id] ?? [];
}