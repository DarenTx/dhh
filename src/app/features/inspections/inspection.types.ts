export type InspectionType = 'move_in' | 'move_out' | 'other';
export type InspectionStatus = 'in_progress' | 'completed';

export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  move_in: 'Move-In',
  move_out: 'Move-Out',
  other: 'Other',
};

export interface Inspection {
  id: string;
  property_id: string;
  lease_id: string | null;
  title: string;
  inspection_type: InspectionType;
  status: InspectionStatus;
  cover_photo_id: string | null;
  is_active: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InspectionRoom {
  id: string;
  inspection_id: string;
  room_type: string;
  display_name: string;
  sort_order: number;
  created_at: string;
  photoCount?: number;
}

export interface InspectionPhoto {
  id: string;
  inspection_id: string;
  room_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  description: string | null;
  is_actionable: boolean;
  is_resolved: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  signedUrl?: string;
  tags?: InspectionTag[];
}

export interface InspectionTag {
  id: string;
  room_type: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface InspectionWithRollup extends Inspection {
  photoCount: number;
  unresolvedActionableCount: number;
  coverPhotoUrl: string | null;
  rooms?: InspectionRoom[];
}

/** Strip trailing numeric suffix: 'bedroom_3' → 'bedroom', 'exterior_front' → 'exterior_front' */
export function canonicalType(roomType: string): string {
  const parts = roomType.split('_');
  return /^\d+$/.test(parts[parts.length - 1]) ? parts.slice(0, -1).join('_') : roomType;
}

/** Returns true if the given ISO timestamp is within 24 hours of now */
export function isWithin24h(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
}

/** Returns true if the given ISO timestamp is within 48 hours of now */
export function isWithin48h(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 48 * 60 * 60 * 1000;
}

/**
 * Generate the ordered room list for a given property.
 * Returns array of { room_type, display_name, sort_order }.
 */
export function generateRooms(
  bedrooms: number | null,
  bathrooms: number | null,
): { room_type: string; display_name: string; sort_order: number }[] {
  const beds = bedrooms ?? 2;
  const baths = Math.ceil(bathrooms ?? 1);

  const rooms: { room_type: string; display_name: string; sort_order: number }[] = [
    { room_type: 'exterior_front', display_name: 'Exterior Front Yard', sort_order: 1 },
    { room_type: 'exterior_left', display_name: 'Exterior Left Side', sort_order: 2 },
    { room_type: 'exterior_right', display_name: 'Exterior Right Side', sort_order: 3 },
    { room_type: 'exterior_back', display_name: 'Exterior Backyard', sort_order: 4 },
    { room_type: 'entryway', display_name: 'Entryway', sort_order: 5 },
    { room_type: 'living_room', display_name: 'Living Room', sort_order: 6 },
    { room_type: 'kitchen', display_name: 'Kitchen', sort_order: 7 },
    { room_type: 'utility_room', display_name: 'Utility Room', sort_order: 8 },
  ];

  for (let i = 1; i <= beds; i++) {
    rooms.push({
      room_type: `bedroom_${i}`,
      display_name: beds === 1 ? 'Bedroom' : `Bedroom ${i}`,
      sort_order: 8 + i,
    });
  }

  for (let i = 1; i <= baths; i++) {
    rooms.push({
      room_type: `bathroom_${i}`,
      display_name: baths === 1 ? 'Bathroom' : `Bathroom ${i}`,
      sort_order: 8 + beds + i,
    });
  }

  rooms.push({
    room_type: 'other',
    display_name: 'Other',
    sort_order: 8 + beds + baths + 1,
  });

  return rooms;
}
