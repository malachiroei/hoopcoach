import { getZoneCenter } from '@/src/cv/courtMapper';
import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';
import type { CourtZone, ShotEvent } from '@/src/types';

export type CloudShotZone = 'paint' | 'mid' | 'free_throw' | 'three' | 'corner_three' | null;
export type CloudShotSide = 'left' | 'center' | 'right' | null;
export type CloudShotEvent = 'shot_made' | 'shot_missed' | 'no_shot';

export interface DetectShotResponse {
  observation: string;
  event: CloudShotEvent;
  zone: CloudShotZone;
  side: CloudShotSide;
  confidence: number;
}

export function mapCloudZoneToCourtZone(zone: CloudShotZone, side: CloudShotSide): CourtZone {
  const resolvedSide = side ?? 'center';

  switch (zone) {
    case 'paint':
    case 'free_throw':
      return 'paint';
    case 'mid':
      if (resolvedSide === 'left') return 'midLeft';
      if (resolvedSide === 'right') return 'midRight';
      return 'midCenter';
    case 'three':
      if (resolvedSide === 'left') return 'threeLeft';
      if (resolvedSide === 'right') return 'threeRight';
      return 'threeCenter';
    case 'corner_three':
      return resolvedSide === 'right' ? 'cornerRight' : 'cornerLeft';
    default:
      if (resolvedSide === 'left') return 'midLeft';
      if (resolvedSide === 'right') return 'midRight';
      return 'midCenter';
  }
}

export function mapCloudDetectionToShotEvent(result: DetectShotResponse): ShotEvent | null {
  if (result.event === 'no_shot') {
    return null;
  }

  const zone = mapCloudZoneToCourtZone(result.zone, result.side);

  return {
    made: result.event === 'shot_made',
    zone,
    position: getZoneCenter(zone),
    timestamp: Date.now(),
    confidence: result.confidence,
  };
}

function stripBase64Prefix(value: string): string {
  const commaIndex = value.indexOf(',');
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

export async function invokeDetectShot(body: {
  imageBase64: string;
  prevImageBase64?: string;
}): Promise<DetectShotResponse> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }

  const { data, error } = await supabase.functions.invoke<DetectShotResponse>('detect-shot', {
    body: {
      imageBase64: stripBase64Prefix(body.imageBase64),
      prevImageBase64: body.prevImageBase64
        ? stripBase64Prefix(body.prevImageBase64)
        : undefined,
    },
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('detect-shot returned no data');
  }

  return data;
}
