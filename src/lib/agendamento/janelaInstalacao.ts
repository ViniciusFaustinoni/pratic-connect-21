/**
 * Geração da janela de datas disponíveis para agendamento de instalação/vistoria
 * no link público, respeitando o SLA por UF definido em `configuracoes`:
 *   - prazo_instalacao_horas_rj  (default 48h)
 *   - prazo_instalacao_horas_sp  (default 72h)
 *   - prazo_instalacao_autovistoria_horas (default 72h) — fallback p/ demais UFs
 *
 * Fonte canônica: mesma chave consultada pelo `cron-suspender-cobertura-inativacao`.
 * Qualquer mudança de SLA reflete simultaneamente nos dois lados.
 */
import { addDays, format, startOfDay } from 'date-fns';
import { isDomingo, getPeriodosDisponivelsPorHora } from '@/data/autovistoriaConfig';

export type UF = string; // ex: 'RJ', 'SP'

export interface PrazosPorUF {
  rj: number;
  sp: number;
  default: number;
}

export const PRAZOS_DEFAULT: PrazosPorUF = {
  rj: 48,
  sp: 72,
  default: 72,
};

export function resolverPrazoHoras(uf: string | null | undefined, prazos: PrazosPorUF): number {
  const ufNorm = (uf || '').trim().toUpperCase();
  if (ufNorm === 'RJ') return prazos.rj;
  if (ufNorm === 'SP') return prazos.sp;
  return prazos.default;
}

interface GerarDatasParams {
  agora: Date;
  prazoHoras: number;
  datasBloqueadas: Set<string>; // yyyy-MM-dd
}

/**
 * Gera as datas (a partir de hoje) que ainda têm pelo menos um período disponível
 * e cujo *início do dia* cai antes do deadline (agora + prazoHoras).
 *
 * Regras:
 * - Pula domingos e datas bloqueadas.
 * - Inclui hoje só se ainda houver algum período disponível pela hora atual.
 * - Após 16h, ofertamos D+1 normalmente apenas se ele couber no prazo;
 *   senão o usuário verá lista vazia (intencional: trataremos na UI).
 * - Iteração com guard para nunca travar (max 14 dias absolutos).
 */
export function gerarDatasDentroDoPrazo({
  agora,
  prazoHoras,
  datasBloqueadas,
}: GerarDatasParams): Date[] {
  const datas: Date[] = [];
  const deadline = new Date(agora.getTime() + prazoHoras * 60 * 60 * 1000);
  const inicioHoje = startOfDay(agora);

  let dia = inicioHoje;
  let guard = 0;
  while (guard < 14) {
    // Para de iterar quando o próprio início do dia já passou do deadline
    if (dia.getTime() > deadline.getTime()) break;

    const chave = format(dia, 'yyyy-MM-dd');
    const ehHoje = guard === 0;

    if (!isDomingo(dia) && !datasBloqueadas.has(chave)) {
      const periodos = ehHoje
        ? getPeriodosDisponivelsPorHora(agora)
        : getPeriodosDisponivelsPorHora(dia);
      if (periodos.length > 0) {
        datas.push(new Date(dia));
      }
    }

    dia = addDays(dia, 1);
    guard++;
  }

  return datas;
}
