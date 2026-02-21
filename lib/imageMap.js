// C:\Users\jante\bno-api\lib\imageMap.js
'use strict';

/**
 * Mapping: Resource/Category name -> array of image URLs (Supabase public bucket).
 * De-duped per category.
 */
const RESOURCE_CATEGORY_IMAGES = {
  "Chalet Strandafjellet": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%209.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%2010.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%2011.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%2012.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%2013.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%2014.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/chalet%20strandafjellet%2015.jpg",
  ],

  "Strandafjellet Mountain Logde": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain-Lodge-Strandafjellet.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain-Lodge-Strandafjellet1.jpg",
  ],

  "Fjord Panorama": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjord%20Panorama.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjord%20Panorama%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjord%20Panorama%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjord%20Panorama%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjord%20Panorama%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjord%20Panorama%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjord%20Panorama%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjord%20Panorama%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjord%20Panorama%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjord%20Panorama%209.jpg",
  ],

  "Rorbu": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu%207.jpg",
  ],

  "Riverside": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/riverside.jpg",
  ],

  "Mountain View Logde": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Logde.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/mountain%20View%20Logde%201.png",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/mountain%20View%20Logde%202.png",
  ],

  "Koie Deluxe I": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20I.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20deluxe%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%207.jpg",
  ],

  "Koie Deluxe II": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20deluxe%20II.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20II%200.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20II%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20II%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20II%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20II%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20II%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20II%206.jpg",
  ],

  "Sjåfram": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Sjaafram.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Sjaafram%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Sjaafram%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Sjaafram%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Sjaafram%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Sjaafram%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Sjaafram%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Sjaafram%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Sjaafram%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Sjaafram%209.jpg",
  ],

  "Tine Mountain Cabin II": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Tiny%20Mountain%20Cabin%20II%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Tiny%20Mountain%20Cabin%20II%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Tiny%20Mountain%20Cabin%20II%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Tiny%20Mountain%20Cabin%20II%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Tiny%20Mountain%20Cabin%20II%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Tiny%20Mountain%20Cabin%20II%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Tiny%20Mountain%20Cabin%20II%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Tiny%20Mountain%20Cabin%20II%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Tiny%20Mountain%20Cabin%20II%209.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Tiny%20Mountain%20Cabin%20II%2010.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Tiny%20Mountain%20Cabin%20II%2011.jpg",
  ],

  "Øklevegen 2": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202.jpg"],
  "Øklevegen 3": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%201.jpg"],
  "Øklevegen 4": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%202.jpg"],
  "Øklevegen 5": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%203.jpg"],
  "Øklevegen 6": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%204.jpg"],
  "Øklevegen 7": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%205.jpg"],
  "Øklevegen 8": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%206.jpg"],
  "Øklevegen 9": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%207.jpg"],
  "Øklevegen 10": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%208.jpg"],
  "Øklevegen 11": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%209.jpg"],
  "Øklevegen 12": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%2010.jpg"],
  "Øklevegen 13": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%2011.jpg"],

  "Fjellsætra Alpegrend": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend%207.jpg",
  ],

  "Utsikten": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Utsikten.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Utsikten%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Utsikten%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Utsikten%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Utsikten%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Utsikten%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Utsikten%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Utsikten%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Utsikten%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Utsikten%209.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Utsikten%2010.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Utsikten%2011.jpg",
  ],

  "Harevadet 211": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Harevadet%20211.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Harevadet%20211%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Harevadet%20211%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Harevadet%20211%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Harevadet%20211%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Harevadet%20211%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Harevadet%20211%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Harevadet%20211%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Harevadet%20211%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Harevadet%20211%209.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Harevadet%20211%2010.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Harevadet%20211%2011.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Harevadet%20211%2012.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Harevadet%20211%2013.jpg",
  ],

  "Lake View Apartment B4/L3 (2 bedrooms + loft)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3%207.jpg",
  ],

  "Lake View Apartment B5/L6 (4 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B5L6.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B5L6%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B5L6%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B5L6%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B5L6%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B5L6%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B5L6%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B5L6%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B5L6%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B5L6%209.jpg",
  ],

  "Lastølen B9/N2 (2 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%204.jpg",
  ],

  "Lastølen B5/S2 (3 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%203s%20.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%203s%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%203s%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%203s%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%203s%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%203s%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%203s%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%203s%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%203s%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%203s%209.jpg",
  ],

  "Røde Kors ground floor": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rode%20kors%20groud%20floor.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rode%20kors%20groud%20floor%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rode%20kors%20groud%20floor%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rode%20kors%20groud%20floor%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rode%20kors%20groud%20floor%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rode%20kors%20groud%20floor%205.jpg",
  ],

  "Koie Family": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Family.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Family%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Family%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Family%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Family%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Family%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Family%206.jpg",
  ],

  "Koie Smart": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/koie%20smart.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Smart%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Smart%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Smart%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Smart%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Smart%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Smart%206.jpg",
  ],

  "Koie Standard": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20standard.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Standard%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Standard%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Standard%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Standard%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Standard%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Standard%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Standard%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Standard%208.jpg",
  ],

  "Koie Holiday Home 3": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Holiday%20Home%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Holiday%20Home%203%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Holiday%20Home%203%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Holiday%20Home%203%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Holiday%20Home%203%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Holiday%20Home%203%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Holiday%20Home%203%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Holiday%20Home%203%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Holiday%20Home%203%208.jpg",
  ],

  "Mountain View Apartments 304 (Penthouse)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304%201a.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304%209.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304%2010.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304%2011.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304%2012.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20304%2013.jpg",
  ],

  "Mountain View Apartments 205": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20205%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20205%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20205%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20205%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20205%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20205%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20205%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20205%208.jpg",
  ],

  "Mountain View Apartments 102": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20102%20a.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20102.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20102%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20102%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20102%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20102%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20102%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20102%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20102%207.jpg",
  ],

  "Mountain View Apartments 301": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20301.jpg",
  ],

  "Mountain View Apartments 203": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20203.jpg",
  ],

  "Stranda Fjellgrend 42B (2 bedrooms + loft)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/1%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/2%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/3%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/4%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/5%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/6%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/7%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/8%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/9%20Stranda%20Fjellgrend%2042B%202%20bedrooms%20loft.jpg",
  ],

  "Stranda Fjellgrend 46A (3 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/stranda%20fjellgrend%203%20soverom.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2046A%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2046A%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2046A%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2046A%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2046A%205.png",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2046A%206.png",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2046A%207.png",
  ],

  "Stranda Fjellgrend 16A (3 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%208.jpg",
  ],

  "Stranda Fjellgrend 98B (2 bedrooms + loft)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%206.png",
  ],

  "Stranda Fjellgrend 29C (2 bedrooms + loft)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2029C%20(2%20bedrooms%20+%20loft).jpg",
  ],

  "Skarhaug Panorama Lodge": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Skarhaug%20Panorama%20Lodge%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Skarhaug%20Panorama%20Lodge%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Skarhaug%20Panorama%20Lodge%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Skarhaug%20Panorama%20Lodge%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Skarhaug%20Panorama%20Lodge%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Skarhaug%20Panorama%20Lodge%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Skarhaug%20Panorama%20Lodge%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Skarhaug%20Panorama%20Lodge%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Skarhaug%20Panorama%20Lodge%209.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Skarhaug%20Panorama%20Lodge%2010.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Skarhaug%20Panorama%20Lodge%2011.jpg",
  ],

  "Mountain View Apartment 201": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartment%20201%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartment%20201%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartment%20201%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartment%20201%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartment%20201%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartment%20201%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartment%20201%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartment%20201%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartment%20201%209.jpg",
  ],

  "Stranda Fjellgrend 14A (with jacuzzi & 3 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2014A%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2014A%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2014A%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2014A%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2014A%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2014A%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2014A%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2014A%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2014A%209.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2014A%2010.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2014A%2011.jpg",
  ],

  "Stranda Fjellgrend 50A (2 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%207.png",
  ],

  "Stranda Fjellgrend 64A (2 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%207.png",
  ],

  "Stranda Fjellgrend 76B (2 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%207.png",
  ],

  "Stranda Fjellgrend 78B (2 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%207.png",
  ],

  "Stranda Fjellgrend 80A (3 bedrooms)": [
    // Note: one line in your list had a blank name but this URL; assuming it belongs here:
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%208.jpg",
  ],

  "Stranda Fjellgrend 80B (3 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%208.jpg",
  ],

  "Stranda Fjellgrend 82A (3 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%208.jpg",
  ],

  "Stranda Fjellgrend 98A (3 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%208.jpg",
  ],

  "Stranda Fjellgrend 80C (3 bedrooms + loft)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%209.jpg",
  ],

  "Stranda Fjellgrend 80D (3 bedrooms + loft)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2080C%209.jpg",
  ],

  "Stranda Fjellgrend 60A (3 bedrooms & 2 bathrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%208.jpg",
  ],

  "Stranda Fjellgrend 60B (3 bedrooms & 2 bathrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%208.jpg",
  ],

  "Stranda Fjellgrend 68A (3 bedrooms & 2 bathrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%208.jpg",
  ],

  "Stranda Fjellgrend 68B (3 bedrooms & 2 bathrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%208.jpg",
  ],

  "Koie Camper": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/koie%20camper.jpg"],
  "Koie Caravan": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20caravan.jpg"],
  "Koie Tent": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20caravan.jpg"],

  "Bergebu": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Bergebu.jpg"],
  "Gladheim": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Gladheim.jpg"],
  "Langlofonna": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Langlofonna.jpg"],
  "Lykkeli": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lykkeli.jpg"],

  "Tiny Mountain Cabin I": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Tiny%201.jpg"],
  "Valley View": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Valley%20View.jpg"],

  "Harevadet 78": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/harevadet%2078.jpg"],

  "Lake View Apartment B5/L5 (4 bedrooms & 2 bathrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/lake%20View%20Apartment%204%20soverom%202%20bad.jpg",
  ],

  "Lastølen B10/S1 (2 bedrooms)": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen.jpg"],

  "Røde Kors": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/rodekors%201.jpg"],

  "Koie Holiday Home 25": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/koie%2025.jpg"],

  "Mountain View Apartments 103": ["https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20103.jpg"],

  "Stranda Fjellgrend 35C (2 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%207.png",
  ],

  "Stranda Fjellgrend 72A (2 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%207.png",
  ],

  "Stranda Fjellgrend 78A (2 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%207.png",
  ],

  "Stranda Fjellgrend 14B (2 bedrooms + loft)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%206.png",
  ],

  "Stranda Fjellgrend 31D (2 bedrooms + loft)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%206.png",
  ],

  "Stranda Fjellgrend 36B (2 bedrooms + loft)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%206.png",
  ],

  "Stranda Fjellgrend 12A (3 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%208.jpg",
  ],

  "Stranda Fjellgrend 20A (3 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%208.jpg",
  ],

  "Stranda Fjellgrend 32A (3 bedrooms)": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2016A%208.jpg",
  ],

  "Trysilbua": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/trysilbua.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Trysilbua%201.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Trysilbua%202.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Trysilbua%203.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Trysilbua%204.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Trysilbua%205.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Trysilbua%206.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Trysilbua%207.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Trysilbua%208.jpg",
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Trysilbua%209.jpg",
  ],
};

// Optional helper(s)
function getImagesForCategory(categoryName) {
  return RESOURCE_CATEGORY_IMAGES[categoryName] || [];
}

module.exports = {
  RESOURCE_CATEGORY_IMAGES,
  getImagesForCategory,
};