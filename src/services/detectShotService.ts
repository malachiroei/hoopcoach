import { FunctionsHttpError } from '@supabase/supabase-js';
import { getZoneCenter } from '@/src/cv/courtMapper';
import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';
import type { CourtZone, ShotEvent } from '@/src/types';

export type CloudShotZone = 'paint' | 'mid' | 'free_throw' | 'three' | 'corner_three' | null;
export type CloudShotSide = 'left' | 'center' | 'right' | null;
export type CloudShotEvent = 'shot_made' | 'shot_missed' | 'no_shot';
export type CloudShotPhase = 'idle' | 'attempt' | 'outcome';
export type DetectShotMode = 'track' | 'outcome' | 'calibrate';

export interface CloudNormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface CloudPlayerBox {
  index: number;
  box: CloudNormalizedBox;
}

export interface DetectShotResponse {
  observation: string;
  event: CloudShotEvent;
  zone: CloudShotZone;
  side: CloudShotSide;
  confidence: number;
  ballVisible: boolean;
  hoopVisible: boolean;
  shotPhase: CloudShotPhase;
  shotActive?: boolean;
  ballBox?: CloudNormalizedBox | null;
  hoopBox?: CloudNormalizedBox | null;
  players?: CloudPlayerBox[];
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

  if (!result.hoopVisible) {
    return null;
  }

  const hasShotSignal =
    result.ballVisible ||
    result.shotActive ||
    result.shotPhase === 'attempt' ||
    result.shotPhase === 'outcome' ||
    result.zone === 'free_throw';

  if (!hasShotSignal) {
    return null;
  }

  if (result.confidence < 0.3) {
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

async function formatInvokeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response | undefined;
    if (response) {
      try {
        const body = await response.clone().json();
        if (typeof body?.error === 'string') {
          return formatCloudApiError(body.error, response.status);
        }
      } catch {
        // ignore JSON parse failures
      }
      return `detect-shot failed (${response.status}). Deploy the function and set GEMINI_API_KEY or OPENAI_API_KEY in Supabase secrets.`;
    }
  }

  if (error instanceof Error) {
    return formatCloudApiError(error.message);
  }

  return 'Cloud detection failed';
}

function formatCloudApiError(message: string, status?: number): string {
  if (message.includes('GEMINI_FREE_TIER') || message.includes('free_tier')) {
    return 'מפתח Gemini עדיין במכסה חינמית — הפעל Billing ב-Google AI Studio ועדכן את GEMINI_API_KEY ב-Supabase';
  }

  if (message.includes('429') || message.toLowerCase().includes('quota')) {
    return 'מכסת Gemini נגמרה — ודא ש-Billing פעיל בפרויקט Google שלך';
  }

  if (status) {
    return `detect-shot failed (${status}): ${message.slice(0, 120)}`;
  }

  return message;
}

export async function invokeDetectShot(body: {
  imageBase64: string;
  prevImageBase64?: string;
  prevImage2Base64?: string;
  mode?: DetectShotMode;
  screenMode?: boolean;
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
      prevImage2Base64: body.prevImage2Base64
        ? stripBase64Prefix(body.prevImage2Base64)
        : undefined,
      mode: body.mode ?? 'track',
      screenMode: body.screenMode ?? true,
    },
  });

  if (error) {
    throw new Error(await formatInvokeError(error));
  }

  if (!data) {
    throw new Error('detect-shot returned no data');
  }

  return {
    ...data,
    ballVisible: data.ballVisible ?? false,
    hoopVisible: data.hoopVisible ?? false,
    shotPhase: data.shotPhase ?? 'idle',
    shotActive: data.shotActive ?? false,
    ballBox: data.ballBox ?? null,
    hoopBox: data.hoopBox ?? null,
    players: data.players ?? [],
  };
}
