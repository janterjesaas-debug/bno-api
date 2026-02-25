"use strict";
/* lib/imageMap.ts
   Standalone (ingen generatedImageMap-import). Lim inn hele denne fila.

   NB:
   - Rader i lista di uten ResourceCategoryId er tolket som “flere bilder for samme enhet” og er lagt inn under siste oppgitte id.
   - Der ResourceCategoryId faktisk mangler helt (dvs. ikke kan knyttes til en id), må du enten finne id-en i Mews eller legge dem inn senere.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESOURCE_CATEGORY_IMAGES_ALL = exports.RESOURCE_CATEGORY_IMAGES = void 0;
exports.getImagesForResourceCategory = getImagesForResourceCategory;
exports.RESOURCE_CATEGORY_IMAGES = {
    // -------------------------
    // EKSISTERENDE (det du hadde)
    // -------------------------
    // Fagerhøy 1181
    "7b6a63f0-f035-4248-8caf-b31b00c7b029": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fagerhoy2-01.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fagerhoy2-02.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fagerhoy2-03.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fagerhoy2-04.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fagerhoy2-05.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fagerhoy2-06.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fagerhoy2-07.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fagerhoy2-08.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fagerhoy2-09.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fagerhoy2-10.jpg",
    ],
    // Litunet 721B
    "c5d45a72-6f11-4a3a-9b78-b32c00a3c09b": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Litunet721b_1.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Litunet721b_2.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Litunet721b_3.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Litunet721b_4.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Litunet721b_5.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Litunet721b_6.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Litunet721b_7.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Litunet721b_8.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Litunet721b_9.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Litunet721b_10.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Litunet721b_11.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Litunet721b_12.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Litunet%20ski%20in%20ski%20out%20bakke%2013.jpg",
    ],
    // Ugla 917 – Trysilfjell Hytteområde (14 bilder)
    "06160e45-0a97-401c-889c-b32c00a4bb64": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Ugla%20917%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Ugla%20917%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Ugla%20917%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Ugla%20917%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Ugla%20917%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Ugla%20917%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Ugla%20917%207.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Ugla%20917%208.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Ugla%20917%209.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Ugla%20917%2010.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Ugla%20917%2011.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Ugla%20917%2012.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Ugla%20917%2013.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Ugla%20917%2014.jpg",
    ],
    // Vestsidevegen 14 – Trysil Sentrum (15 bilder)
    "35f40983-7045-409a-a0ae-b3bb00ba99fc": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%207.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%208.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%209.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%2010.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%2011.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%2012.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%2013.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%2014.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Vestsidevegen%2015.jpg",
    ],
    // Tandådalen Sälen
    "e2add613-9f83-4acc-abef-b32c00a74bd9": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Demo%203.jpg",
    ],
    // Högfjället Sälen
    "25859550-3b6b-424b-8eb5-b32c00a70c07": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Demo%202.jpg",
    ],
    // Lindvallen Sälen
    "2f5505b5-3b94-4b03-a4ca-b32c00a6c1c0": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Demo%204.jpg",
    ],
    // -------------------------
    // NYE (fra tabellen din)
    // -------------------------
    // Chalet Strandafjellet
    "a0b4d9a2-266c-40af-b4ba-b15a007ef02f": [
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
    // Strandafjellet Mountain Logde
    "2f1beca3-adb9-47ae-aa85-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain-Lodge-Strandafjellet.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain-Lodge-Strandafjellet1.jpg",
    ],
    // Fjord Panorama
    "07698215-18e7-454d-b4cf-b15a007ef02f": [
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
    // Rorbu
    "34993a51-69ec-469e-bb25-b1950040d184": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu%207.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rorbu.jpg",
    ],
    // Riverside
    "4d9807a9-8542-4116-ae06-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/riverside.jpg",
    ],
    // Mountain View Logde
    "6fdf8c50-f57c-49de-afc1-b2b300e88a09": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Logde.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/mountain%20View%20Logde%201.png",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/mountain%20View%20Logde%202.png",
    ],
    // Koie Deluxe I
    "51cff127-0eb2-4e59-bdaf-b16e0144b672": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20I.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20deluxe%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%207.jpg",
    ],
    // Koie Deluxe II
    "acc74eff-22fc-4f37-9dd6-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20deluxe%20II.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20II%200.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20II%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20II%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20II%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20II%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20II%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Deluxe%20II%206.jpg",
    ],
    // Sjåfram
    "4e690c24-dcd4-4fc7-b672-b15a007ef02f": [
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
    // Tiny Mountain Cabin II
    "3a0f4243-1775-4990-874f-b1950043000f": [
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
    // Øklevegen 2
    "80818c3f-2573-4494-8ba3-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%207.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%208.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%209.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%2010.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Okslevegen%202%2011.jpg",
    ],
    // Fjellsætra Alpegrend
    "b47530da-4028-42a1-a17e-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Fjellsetra%20Alpegrend%207.jpg",
    ],
    // Utsikten
    "894b0878-441f-4c11-a807-b15a007ef02f": [
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
    // Harevadet 211
    "abb1a8e2-ceee-4edc-aa75-b15a007ef02f": [
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
    // Lake View Apartment B4/L3 (2 bedrooms + loft)
    "a713bf60-4d87-41ab-812c-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lake%20View%20Apartment%20B4L3%207.jpg",
    ],
    // Lake View Apartment B5/L6 (4 bedrooms)
    "4b5d7e45-3515-4076-87cc-b15a007ef02f": [
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
    // Lastølen B9/N2 (2 bedrooms)
    "6ddde6fb-48f1-485b-bfbd-b220011453e9": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen%204.jpg",
    ],
    // Lastølen B5/S2 (3 bedrooms)
    "c2530b78-8c5b-4fc8-b39f-b22001158262": [
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
    // Røde Kors ground floor (og Røde Kors)
    "867c3e6f-7646-4240-84c4-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rode%20kors%20groud%20floor.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rode%20kors%20groud%20floor%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rode%20kors%20groud%20floor%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rode%20kors%20groud%20floor%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rode%20kors%20groud%20floor%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Rode%20kors%20groud%20floor%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/rodekors%201.jpg",
    ],
    // Koie Family
    "a6117fdf-342b-457b-b0b9-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Family.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Family%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Family%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Family%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Family%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Family%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Family%206.jpg",
    ],
    // Koie Smart
    "6bfa07e2-85ae-40b5-9e62-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/koie%20smart.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Smart%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Smart%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Smart%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Smart%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Smart%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20Smart%206.jpg",
    ],
    // Koie Standard
    "22375a4b-751e-41df-ad35-b15a007ef02f": [
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
    // Koie Holiday Home 3
    "ed46726e-e7b7-4372-a23f-b15a007ef02f": [
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
    // Mountain View Apartments 304 (Penthouse)
    "f4094e42-219b-40a4-b839-b1950042b19e": [
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
    // Mountain View Apartments 205
    "072be395-785f-4b0e-bcc4-b18000cd2855": [
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
    // Mountain View Apartments 102
    "5bd7be93-f889-467b-8189-b1950042046f": [
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
    // Mountain View Apartments 301
    "96f2f0c7-feb0-4526-945f-b3ad00a5739f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20301.jpg",
    ],
    // Mountain View Apartments 203
    "a7a5b9ce-caa6-4dd7-9e7a-b2ab0165b9f6": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20203.jpg",
    ],
    // Stranda Fjellgrend 42B (2 bedrooms + loft)
    "ac18e5f6-6c88-4a01-a1db-b2ad0137d6b5": [
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
    // Stranda Fjellgrend 46A (3 bedrooms)
    "4c37ce32-956f-4b7a-95f5-b2e20139d9e3": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/stranda%20fjellgrend%203%20soverom.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2046A%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2046A%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2046A%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2046A%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2046A%205.png",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2046A%206.png",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2046A%207.png",
    ],
    // Stranda Fjellgrend 16A (3 bedrooms)
    "94744891-65a9-46cb-958b-b2e2013a2b68": [
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
    // Stranda Fjellgrend 98B (2 bedrooms + loft)
    "a8301687-1af8-4ea4-9ce0-b2e20145e011": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%206.png",
    ],
    // Skarhaug Panorama Lodge
    "503a9fb6-db71-4a5f-b879-b3df00d249a9": [
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
    // Mountain View Apartment 201
    "57011669-35e7-4ac9-8f76-b3e100d7f92e": [
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
    // Stranda Fjellgrend 14A (with jacuzzi & 3 bedrooms)
    "da95b306-10a2-4a04-8010-b15a007ef02f": [
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
    // Stranda Fjellgrend 50A (2 bedrooms)
    "7f9787f5-fd52-4ac6-bbbc-b1fd0149aa91": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%207.png",
    ],
    // Stranda Fjellgrend 64A (2 bedrooms)
    "84cecb52-8c0d-40d3-add6-b1fd0149be97": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%207.png",
    ],
    // Stranda Fjellgrend 76B (2 bedrooms)
    "7f06b9a5-9306-42b4-a2d8-b1fd014a15fc": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%207.png",
    ],
    // Stranda Fjellgrend 16B (2 bedrooms + loft)
    "e210d1cc-0f05-44bf-8f93-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%206.png",
    ],
    // Stranda Fjellgrend 24B (2 bedrooms + loft)
    "7ccdf353-6e3c-4c80-9a85-b2200101d802": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%206.png",
    ],
    // Stranda Fjellgrend 32B (2 bedrooms + loft)
    "8f0f3f35-8d0f-450f-94d3-b2200102131d": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%206.png",
    ],
    // Stranda Fjellgrend 24A (3 bedrooms)
    "b9ffaad9-33ce-41a6-99e9-b1fe007f6bf3": [
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
    // Stranda Fjellgrend 30A (3 bedrooms)
    "078c0ded-070b-4549-9888-b2200102d754": [
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
    // Koie Camper
    "75d3db44-45a1-4310-9cbe-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/koie%20camper.jpg",
    ],
    // Koie Caravan
    "32324f93-8942-413b-a515-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20caravan.jpg",
    ],
    // Koie Tent
    "732d4795-81c8-48e3-ba22-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Koie%20caravan.jpg",
    ],
    // Bergebu
    "aab5a0a1-6743-41d3-b641-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Bergebu.jpg",
    ],
    // Gladheim
    "1ba03370-240f-4a73-b5c3-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Gladheim.jpg",
    ],
    // Langlofonna
    "8a302964-b83b-445b-973e-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Langlofonna.jpg",
    ],
    // Lykkeli
    "fb1f637a-8e13-46a4-83b0-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lykkeli.jpg",
    ],
    // Tiny Mountain Cabin I
    "878b1d23-6c85-4a20-8ee5-b1630119d6b9": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Tiny%201.jpg",
    ],
    // Valley View
    "d183bf9f-0e26-4147-b341-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Valley%20View.jpg",
    ],
    // Harevadet 78
    "d176e9f4-ecd6-46bc-990e-b16300e9d3fb": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/harevadet%2078.jpg",
    ],
    // Lake View Apartment B5/L5 (4 bedrooms & 2 bathrooms)
    "f8bd976f-908a-4a36-a10b-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/lake%20View%20Apartment%204%20soverom%202%20bad.jpg",
    ],
    // Lastølen B10/S1 (2 bedrooms)
    "b35b8c52-35ec-482d-aa20-b15a007ef02f": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Lastolen.jpg",
    ],
    // Koie Holiday Home 25
    "65bf8027-f03d-4a2c-8ea4-b1be0089a061": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/koie%2025.jpg",
    ],
    // Mountain View Apartments 103
    "bb96a008-eeef-4c82-bda1-b29e013c2106": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Mountain%20View%20Apartments%20103.jpg",
    ],
    // Stranda Fjellgrend 35C (2 bedrooms)
    "2e9c5ee7-ce70-4d66-b989-b1fd01497063": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%207.png",
    ],
    // Stranda Fjellgrend 72A (2 bedrooms)
    "402fbc75-067a-4b1b-90f7-b1fd0149e5a3": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%207.png",
    ],
    // Stranda Fjellgrend 78A (2 bedrooms)
    "ace31d40-13b3-4b3c-89fb-b1fd014a2f71": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20F%207.png",
    ],
    // Stranda Fjellgrend 14B (2 bedrooms + loft)
    "b92f07ae-6e35-4673-b510-b1fe007ec8d8": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%206.png",
    ],
    // Stranda Fjellgrend 31D (2 bedrooms + loft)
    "eb8791bf-154c-4a43-bf7f-b2200101f2f1": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%206.png",
    ],
    // Stranda Fjellgrend 36B (2 bedrooms + loft)
    "7faa5b6a-b932-4c8b-84a1-b220011a208b": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%2098B%206.png",
    ],
    // Stranda Fjellgrend 12A (3 bedrooms)
    "f562e533-1f85-4aeb-a92f-b1fe007f2f5a": [
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
    // Stranda Fjellgrend 20A (3 bedrooms)
    "cb1926a5-359d-4852-8f0c-b22001028f86": [
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
    // Stranda Fjellgrend 32A (3 bedrooms)
    "8b70ecf1-22c8-483e-978b-b22001032d04": [
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
    // Stranda Fjellgrend 68A (3 bedrooms & 2 bathrooms)
    "40d58bdf-78cb-4b0a-8088-b220010720e6": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%207.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%208.jpg",
    ],
    // Stranda Fjellgrend 68B (3 bedrooms & 2 bathrooms)
    "64f8ee64-43e4-48df-87b7-b22001073aa6": [
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%201.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%202.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%203.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%204.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%205.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%206.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%207.jpg",
        "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Stranda%20Fjellgrend%203b2b%208.jpg",
    ],
    // Trysilbua
    "bd06103f-184b-4e18-b522-b3f30094beb6": [
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
// Hvis du vil ha “ALL” (samme som RESOURCE_CATEGORY_IMAGES, men beholdt for kompatibilitet)
exports.RESOURCE_CATEGORY_IMAGES_ALL = {
    ...exports.RESOURCE_CATEGORY_IMAGES,
};
function getImagesForResourceCategory(id) {
    if (!id)
        return [];
    return exports.RESOURCE_CATEGORY_IMAGES_ALL[id] ?? [];
}
