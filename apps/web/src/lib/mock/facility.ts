/**
 * Reference facility data for the mock driver.
 *
 * Deliberately realistic — §13 lists `John Doe` / `+1 555-0100` / lorem ipsum as
 * an anti-pattern that "instantly undermines credibility". Phone numbers are
 * rendered masked in the UI (see `maskPhone`), which is both what a real ops
 * console does with responder PII and what keeps a demo recording safe.
 */

import type { Asset, Facility, Responder } from "@/lib/contracts/domain";

export const FACILITY: Facility = {
  id: "northgate",
  name: "Northgate Cold Chain Facility",
  timezone: "Asia/Kolkata",
  quietHoursStart: "22:00",
  quietHoursEnd: "06:00",
};

export const ASSETS: Asset[] = [
  {
    id: "CS-04",
    facilityId: "northgate",
    type: "Cold Storage Unit",
    label: "Vaccine Store 04",
    location: "Zone A · Bay 3",
    metric: "temperature_c",
    safeMin: 2,
    safeMax: 8,
    unit: "°C",
    consequenceDesc: "vaccine inventory is at risk",
    safeWindowMinutes: 90,
    position: [-4.2, 0, -2.4],
    lastHeartbeatAt: "2026-09-02T02:14:33Z",
  },
  {
    id: "CS-01",
    facilityId: "northgate",
    type: "Cold Storage Unit",
    label: "Vaccine Store 01",
    location: "Zone A · Bay 1",
    metric: "temperature_c",
    safeMin: 2,
    safeMax: 8,
    unit: "°C",
    consequenceDesc: "vaccine inventory is at risk",
    safeWindowMinutes: 90,
    position: [-4.2, 0, 2.4],
    lastHeartbeatAt: "2026-09-02T02:14:31Z",
  },
  {
    id: "CS-02",
    facilityId: "northgate",
    type: "Cold Storage Unit",
    label: "Vaccine Store 02",
    location: "Zone A · Bay 2",
    metric: "temperature_c",
    safeMin: 2,
    safeMax: 8,
    unit: "°C",
    consequenceDesc: "vaccine inventory is at risk",
    safeWindowMinutes: 90,
    position: [-4.2, 0, 0],
    lastHeartbeatAt: "2026-09-02T02:14:30Z",
  },
  {
    id: "CHL-02",
    facilityId: "northgate",
    type: "Glycol Chiller",
    label: "Primary Glycol Loop",
    location: "Zone B · Plant Room",
    metric: "pressure_bar",
    safeMin: 3.2,
    safeMax: 6.5,
    unit: " bar",
    consequenceDesc: "the cold loop loses capacity",
    safeWindowMinutes: 120,
    position: [0.8, 0, -1.2],
    lastHeartbeatAt: "2026-09-02T02:14:29Z",
  },
  {
    id: "DK-07",
    facilityId: "northgate",
    type: "Dock Freezer",
    label: "Loading Dock Freezer",
    location: "Zone C · Dock 7",
    metric: "temperature_c",
    safeMin: -22,
    safeMax: -16,
    unit: "°C",
    consequenceDesc: "frozen stock begins to thaw",
    safeWindowMinutes: 60,
    position: [4.6, 0, 1.8],
    lastHeartbeatAt: "2026-09-02T02:09:12Z",
  },
];

export const RESPONDERS: Responder[] = [
  {
    id: "resp-ravi-sharma",
    facilityId: "northgate",
    name: "Ravi Sharma",
    role: "Refrigeration Technician",
    skills: ["refrigeration", "compressor", "glycol"],
    phoneE164: "+919820441207",
    shiftStart: "18:00",
    shiftEnd: "06:00",
    zone: "North",
    ladderPriority: 1,
    preferredLanguage: "en-IN",
    consentAt: "2026-08-11T09:20:00Z",
    cooldownUntil: null,
  },
  {
    id: "resp-anjali-menon",
    facilityId: "northgate",
    name: "Anjali Menon",
    role: "Senior Refrigeration Technician",
    skills: ["refrigeration", "compressor", "controls", "glycol"],
    phoneE164: "+919987230514",
    shiftStart: "18:00",
    shiftEnd: "06:00",
    zone: "North-East",
    ladderPriority: 2,
    preferredLanguage: "en-IN",
    consentAt: "2026-08-11T09:24:00Z",
    cooldownUntil: null,
  },
  {
    id: "resp-devendra-rathi",
    facilityId: "northgate",
    name: "Devendra Rathi",
    role: "Night Shift Supervisor",
    skills: ["supervision", "dispatch", "refrigeration"],
    phoneE164: "+919833077462",
    shiftStart: "20:00",
    shiftEnd: "08:00",
    zone: "All zones",
    ladderPriority: 3,
    preferredLanguage: "hi-IN",
    consentAt: "2026-08-11T09:31:00Z",
    cooldownUntil: null,
  },
  {
    id: "resp-imran-qureshi",
    facilityId: "northgate",
    name: "Imran Qureshi",
    role: "Refrigeration Technician",
    skills: ["refrigeration", "electrical"],
    phoneE164: "+919167504338",
    shiftStart: "06:00",
    shiftEnd: "18:00",
    zone: "North",
    ladderPriority: 4,
    preferredLanguage: "en-IN",
    consentAt: "2026-08-12T11:02:00Z",
    cooldownUntil: null,
  },
];

export function responderById(id: string): Responder {
  const found = RESPONDERS.find((r) => r.id === id);
  if (!found) throw new Error(`Unknown responder: ${id}`);
  return found;
}

export function assetById(id: string): Asset {
  const found = ASSETS.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown asset: ${id}`);
  return found;
}

/** `+919820441207` → `+91 98204 ••207`. Responder PII stays partly redacted. */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/[^\d+]/g, "");
  if (digits.length < 8) return digits;
  const head = digits.slice(0, 8);
  const tail = digits.slice(-3);
  return `${head.slice(0, 3)} ${head.slice(3)} ••${tail}`;
}
