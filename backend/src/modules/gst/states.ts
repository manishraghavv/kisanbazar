/**
 * Indian states and union territories with their GST state codes (the first two digits of a GSTIN).
 * Place of supply and the CGST+SGST / IGST decision are driven by these codes.
 */
export const INDIAN_STATES: Readonly<Record<string, string>> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

export const STATE_CODES: readonly string[] = Object.keys(INDIAN_STATES);

export function isValidStateCode(code: unknown): code is string {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(INDIAN_STATES, code);
}

export function stateName(code: string): string | undefined {
  return INDIAN_STATES[code];
}

const GSTIN_PATTERN = /^(\d{2})[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Format check plus: the state prefix must be a real state code. (No checksum verification.) */
export function isValidGstin(gstin: string): boolean {
  const m = GSTIN_PATTERN.exec(gstin);
  return !!m && isValidStateCode(m[1]);
}

/** State code embedded in a GSTIN, or undefined when the GSTIN is malformed. */
export function stateCodeFromGstin(gstin: string): string | undefined {
  return isValidGstin(gstin) ? gstin.slice(0, 2) : undefined;
}
