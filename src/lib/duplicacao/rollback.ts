/**
 * Tracker de rollback para duplicações atômicas de plano/linha.
 *
 * Modelo:
 * - As duplicações criam várias entidades em sequência (linha → planos → benefits/coberturas → vínculos → regras).
 * - PostgREST não tem transação multi-call; então registramos cada ID criado aqui
 *   e, em caso de falha, desfazemos na ordem inversa.
 *
 * Cascades de FK cobrem:
 *  - delete planos        → cascade em planos_beneficios / planos_coberturas / planos_regioes
 *  - delete benefits      → cascade em benefit_category_exclusions
 *  - entity_eligibility_rules NÃO tem FK → apagamos por entity_id explicitamente.
 */
import { supabase } from '@/integrations/supabase/client';
import { registrarLog, type ModuloAuditoria, type AcaoAuditoria } from '@/hooks/useAuditLog';

export class DuplicacaoTracker {
  productLineIds: string[] = [];
  planoIds: string[] = [];
  benefitIds: string[] = [];
  coberturaIds: string[] = [];
  /** entity_ids cujas regras foram inseridas (rules são apagadas por entity_id) */
  ruleEntityIds: string[] = [];

  trackLine(id: string) { this.productLineIds.push(id); }
  trackPlano(id: string) { this.planoIds.push(id); }
  trackBenefit(id: string) { this.benefitIds.push(id); }
  trackCobertura(id: string) { this.coberturaIds.push(id); }
  trackRulesFor(entityId: string) { this.ruleEntityIds.push(entityId); }
  trackRulesForMany(ids: string[]) { for (const id of ids) this.ruleEntityIds.push(id); }

  /** Desfaz tudo na ordem correta para satisfazer as FKs. */
  async rollback(): Promise<{ ok: boolean; errors: string[] }> {
    const errors: string[] = [];
    const safeDel = async (label: string, p: Promise<{ error: unknown }>) => {
      try {
        const { error } = await p;
        if (error) errors.push(`${label}: ${(error as { message?: string })?.message || String(error)}`);
      } catch (e) {
        errors.push(`${label}: ${(e as Error).message}`);
      }
    };

    // 1. Regras (não cascateia)
    if (this.ruleEntityIds.length > 0) {
      await safeDel(
        'entity_eligibility_rules',
        supabase.from('entity_eligibility_rules').delete().in('entity_id', this.ruleEntityIds) as never,
      );
    }
    // 2. Planos (cascade em planos_beneficios/coberturas/regioes)
    if (this.planoIds.length > 0) {
      await safeDel('planos', supabase.from('planos').delete().in('id', this.planoIds) as never);
    }
    // 3. Benefits (cascade em benefit_category_exclusions). Só pode após os planos sumirem.
    if (this.benefitIds.length > 0) {
      await safeDel('benefits', supabase.from('benefits').delete().in('id', this.benefitIds) as never);
    }
    // 4. Coberturas
    if (this.coberturaIds.length > 0) {
      await safeDel('coberturas', supabase.from('coberturas').delete().in('id', this.coberturaIds) as never);
    }
    // 5. Product line
    if (this.productLineIds.length > 0) {
      await safeDel('product_lines', supabase.from('product_lines').delete().in('id', this.productLineIds) as never);
    }

    return { ok: errors.length === 0, errors };
  }
}

interface AuditoriaDuplicacaoParams {
  modulo: ModuloAuditoria;
  tabela: string;
  /** Item original (id + nome) */
  origem: { id: string; nome: string };
  /** Item criado (preenchido em caso de sucesso) */
  criado?: { id: string; nome: string } | null;
  sucesso: boolean;
  /** Etapa onde falhou (preencher quando sucesso=false) */
  etapaFalha?: string;
  /** Mensagem de erro (preencher quando sucesso=false) */
  erro?: string;
  /** Resultado do rollback (preencher quando sucesso=false) */
  rollback?: { ok: boolean; errors: string[] };
}

/** Registra uma tentativa de duplicação no log de auditoria existente (visível em Diretoria › Logs de Auditoria). */
export async function registrarDuplicacao(params: AuditoriaDuplicacaoParams): Promise<void> {
  const { modulo, tabela, origem, criado, sucesso, etapaFalha, erro, rollback } = params;
  const acao: AcaoAuditoria = 'duplicar';

  // Rótulo da operação derivado da tabela — mantém legibilidade na listagem da Diretoria
  const tipoOperacao =
    tabela === 'product_lines' ? 'Duplicação de linha'
    : tabela === 'planos' ? 'Duplicação de plano'
    : `Duplicação (${tabela})`;

  const statusTag = sucesso
    ? '[SUCESSO]'
    : rollback?.ok === false ? '[FALHA — ROLLBACK PARCIAL]' : '[FALHA REVERTIDA]';

  const corpo = sucesso
    ? `original: "${origem.nome}" → criado: "${criado?.nome ?? '—'}"`
    : `original: "${origem.nome}"${etapaFalha ? ` — etapa que quebrou: ${etapaFalha}` : ''}${erro ? ` — erro: ${erro}` : ''}${rollback && !rollback.ok ? ` — rollback com erros: ${rollback.errors.join('; ')}` : ''}`;

  const descricao = `${statusTag} ${tipoOperacao} — ${corpo}`;

  await registrarLog({
    acao,
    modulo,
    tabela,
    descricao,
    entidade_id: criado?.id ?? origem.id,
    dados_anteriores: { origem },
    dados_novos: {
      tipo_operacao: tipoOperacao,
      status: sucesso ? 'sucesso' : (rollback?.ok === false ? 'falha_rollback_parcial' : 'falha_revertida'),
      sucesso,
      origem,
      criado: criado ?? null,
      etapa_falha: etapaFalha ?? null,
      erro: erro ?? null,
      rollback: rollback ?? null,
    },
  });
}
