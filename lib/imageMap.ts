// lib/imageMap.ts
// Mapping fra Mews ResourceCategoryId -> liste med bilde-URL-er (Supabase)

export const RESOURCE_CATEGORY_IMAGES: Record<string, string[]> = {
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

  // Test: din hytte TFH – Trysilfjell Hytteområde
  "06160e45-0a97-401c-889c-b32c00a4bb64": [
    "https://qcjpfiwootjfqpxhtldm.supabase.co/storage/v1/object/public/bno-images/Demo%201.jpg",
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
};

export function getImagesForResourceCategory(
  id: string | null | undefined
): string[] {
  if (!id) return [];
  return RESOURCE_CATEGORY_IMAGES[id] ?? [];
}
