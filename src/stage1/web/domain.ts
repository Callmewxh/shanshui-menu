export type Line = { id: string; name: string; quantity: number; preparation: string; image?: string; position: number };
export type Menu = { lines: Line[]; tableCount?: number; date?: string; customer?: string; followUp?: string };
// Canonical culinary content; display order and banquet/customer metadata are deliberately absent.
export function pricingContent(menu: Menu): string {
  return JSON.stringify(menu.lines.map(l => [l.id, l.name.normalize('NFC'), l.quantity, l.preparation.normalize('NFC')])
    .sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en')));
}
export function amountMinor(input: string): number {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(input)) throw new Error('请输入有效的每桌金额');
  const [whole, cents = ''] = input.split('.');
  return Number(whole) * 100 + Number(cents.padEnd(2, '0'));
}
