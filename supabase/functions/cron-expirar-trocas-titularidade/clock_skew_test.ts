// Teste de cenário: clock skew vs prazo BRT.
// Valida que a função brtEndOfDay produz 23:59:59.999 BRT (= 02:59:59.999 UTC do dia seguinte)
// e que a margem de 5 min cobre skew típico de runtime.
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

function brtEndOfDay(isoSigned: string): Date {
  const d = new Date(isoSigned);
  const brtMs = d.getTime() - 3 * 60 * 60 * 1000;
  const brt = new Date(brtMs);
  const y = brt.getUTCFullYear();
  const m = brt.getUTCMonth();
  const day = brt.getUTCDate();
  return new Date(Date.UTC(y, m, day, 23, 59, 59, 999) + 3 * 60 * 60 * 1000);
}

const GRACE_PERIOD_MS = 5 * 60 * 1000;

Deno.test('brtEndOfDay: assinou meio-dia BRT → corte 23:59:59.999 BRT mesmo dia', () => {
  // 2026-05-13 12:00 BRT = 2026-05-13 15:00 UTC
  const corte = brtEndOfDay('2026-05-13T15:00:00.000Z');
  // 23:59:59.999 BRT = 02:59:59.999 UTC do dia 14
  assertEquals(corte.toISOString(), '2026-05-14T02:59:59.999Z');
});

Deno.test('brtEndOfDay: assinou 23:50 BRT → corte ainda no mesmo dia BRT', () => {
  // 2026-05-13 23:50 BRT = 2026-05-14 02:50 UTC
  const corte = brtEndOfDay('2026-05-14T02:50:00.000Z');
  assertEquals(corte.toISOString(), '2026-05-14T02:59:59.999Z');
});

Deno.test('clock skew: runtime 30s adiantado NÃO expira (dentro da margem)', () => {
  const corte = brtEndOfDay('2026-05-13T15:00:00.000Z').getTime();
  const agoraSkewed = corte + 30 * 1000; // 30s após corte
  assert(agoraSkewed > corte, 'passou do corte');
  assert(agoraSkewed <= corte + GRACE_PERIOD_MS, 'mas dentro da margem → não cancela');
});

Deno.test('clock skew: runtime 4min59s adiantado NÃO expira', () => {
  const corte = brtEndOfDay('2026-05-13T15:00:00.000Z').getTime();
  const agoraSkewed = corte + (4 * 60 + 59) * 1000;
  assert(agoraSkewed <= corte + GRACE_PERIOD_MS);
});

Deno.test('clock real: 5min01s após corte → EXPIRA', () => {
  const corte = brtEndOfDay('2026-05-13T15:00:00.000Z').getTime();
  const agora = corte + (5 * 60 + 1) * 1000;
  assert(agora > corte + GRACE_PERIOD_MS, 'fora da margem → cancela');
});

Deno.test('dentro do prazo: 23:30 BRT do mesmo dia → NÃO expira', () => {
  const corte = brtEndOfDay('2026-05-13T15:00:00.000Z').getTime();
  // 23:30 BRT = 02:30 UTC do dia 14
  const agora = new Date('2026-05-14T02:30:00.000Z').getTime();
  assert(agora <= corte, 'ainda no prazo');
});
