/**
 * Maps between demo Supabase IDs (demo-*) and legacy mock IDs (patient-1/doctor-1).
 * This lets us reuse existing mock datasets while the demo auth uses demo-* IDs.
 */

export const demoToMockId: Record<string, string> = {
  'demo-doctor-001': 'doctor-1',
  'demo-patient-001': 'patient-1',
  'demo-patient-002': 'patient-2',
  'demo-patient-003': 'patient-3',
};

export const mockToDemoId: Record<string, string> = Object.fromEntries(
  Object.entries(demoToMockId).map(([demo, mock]) => [mock, demo])
);

export function toMockId(id: string | null | undefined): string | null {
  if (!id) return null;
  return demoToMockId[id] ?? id;
}

export function toDemoId(id: string | null | undefined): string | null {
  if (!id) return null;
  return mockToDemoId[id] ?? id;
}


