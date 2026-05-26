# Gate canônico Cadastro→Monitoramento — extensão E2E

Caso comprobatório: KVV7538 entrou no Monitoramento em 26/05 13:52 enquanto `contratos.cadastro_aprovado=false` (só virou `true` às 15:49). O gate canônico existe em `useAtribuicaoManual`/`useAprovacaoMonitoramento`, mas os hooks de operação (Serviços de Campo, Rotas, Atribuídos, Fila) leem direto e expõem o serviço pré-aprovação.

A exceção `origem='troca_titularidade'` é preservada em todos os pontos — o contrato do novo titular só recebe `aprovado_em` no `efetivar-troca-titularidade`, mas a fila precisa ficar visível antes disso.

---

## 1) Frontend — Gate em 5 hooks

Padrão reaproveitado de `src/hooks/useAtribuicaoManual.ts:33-102` (join em `contratos!servicos_contrato_id_fkey(aprovado_em)` + filtro `!s.contrato_id || s.origem==='troca_titularidade' || !!s.contrato?.aprovado_em`).

### 1.1 `src/hooks/useServicos.ts` — função `useServicos` (linhas 269-339)

Fonte raiz. Como `useServicosCampoUnificado` consome `useServicos`, fechar aqui já tampa Serviços de Campo.

- Adicionar ao `.select(...)` o join `contrato:contratos!servicos_contrato_id_fkey(aprovado_em, origem_troca_titularidade_id)` (substituindo o atual `contrato:contratos(id, numero)` por uma seleção combinada que mantenha `id, numero, aprovado_em, origem_troca_titularidade_id`).
- Após o `await query`, aplicar filtro:
  ```ts
  const filtrados = (data || []).filter((s: any) => {
    if (!s.contrato_id) return true;                        // serviços avulsos sem contrato
    if (s.origem === 'troca_titularidade') return true;     // exceção canônica
    return !!s.contrato?.aprovado_em;
  });
  ```
- Atualizar tipo `Servico.contrato` (linhas ~110-115) para incluir `aprovado_em: string | null` e `origem_troca_titularidade_id: string | null`.

Efeito secundário: `useServicosCampoUnificado` (`src/pages/monitoramento/ServicosCampoUnificado.tsx`) passa a esconder automaticamente. Nada a alterar lá.

### 1.2 `src/hooks/useServicosAtribuidos.ts` (linhas 106-128)

Após o `await query` (depois de `if (!servicos?.length) return [];`):

- Coletar `contratoIds` dos `servicos` (precisa adicionar `contrato_id, origem` ao `.select` da linha 109).
- Buscar `contratos`: `.from('contratos').select('id, aprovado_em').in('id', contratoIds)` → Map `contratoAprovado`.
- Filtrar: manter quando `!s.contrato_id || s.origem==='troca_titularidade' || contratoAprovado.get(s.contrato_id)`.

### 1.3 `src/hooks/useServicosRota.ts` — view `servicos_pendentes_rota`

A view não expõe `contrato_id`/`aprovado_em` (ver `supabase/migrations/20260119184343_*.sql`). Caminho canônico: recriar a view filtrando no SQL (Passo 2.B abaixo). Os 3 hooks que a consomem (`useBairrosServicos`, `useServicosDisponiveis`, `useServicosPorBairros`) ficam sem alteração de código — passam a receber só linhas aprovadas.

### 1.4 `src/hooks/useFilaServicos.ts` (linhas 56-77)

Estender o `.select(...)` do servico aninhado com `contrato:contratos!servicos_contrato_id_fkey(aprovado_em)` + campo `origem` no servico. Filtrar `data` no JS antes do cast: descartar quando `s.servico?.contrato_id && s.servico.origem!=='troca_titularidade' && !s.servico.contrato?.aprovado_em`. (A relação `servicos.contrato_id` é opcional; itens sem contrato continuam visíveis.)

### 1.5 `src/hooks/useServicosCampoUnificado.ts`

Sem alteração — herda o gate via `useServicos`.

---

## 2) Backend — Migrations

### 2.A Trigger BEFORE INSERT em `agendamentos_base`

Mesmo padrão de `trg_guard_instalacao_concluida_exige_cadastro_aprovado` (`supabase/migrations/20260519194552_*.sql:65`).

```sql
CREATE OR REPLACE FUNCTION public.fn_guard_agendamento_base_exige_cadastro_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aprovado_em timestamptz;
  v_origem_troca uuid;
BEGIN
  IF NEW.cotacao_id IS NULL THEN
    RETURN NEW;  -- agendamentos avulsos (sem cotação) passam
  END IF;

  SELECT c.aprovado_em, c.origem_troca_titularidade_id
    INTO v_aprovado_em, v_origem_troca
  FROM public.contratos c
  WHERE c.cotacao_id = NEW.cotacao_id
  ORDER BY c.created_at DESC
  LIMIT 1;

  -- Sem contrato ainda → permite (fluxos legados / pré-contrato)
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Exceção canônica: troca de titularidade
  IF v_origem_troca IS NOT NULL THEN RETURN NEW; END IF;

  IF v_aprovado_em IS NULL THEN
    RAISE EXCEPTION 'agendamento_base bloqueado: contrato da cotação % ainda não foi aprovado pelo Cadastro', NEW.cotacao_id
      USING ERRCODE = 'check_violation',
            HINT = 'Aguardar aprovação do Cadastro antes de criar agendamento de Monitoramento';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_agendamento_base_exige_cadastro_aprovado ON public.agendamentos_base;
CREATE TRIGGER trg_guard_agendamento_base_exige_cadastro_aprovado
  BEFORE INSERT ON public.agendamentos_base
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_agendamento_base_exige_cadastro_aprovado();
```

### 2.B View `servicos_pendentes_rota` — filtrar contratos não aprovados

```sql
DROP VIEW IF EXISTS servicos_pendentes_rota;
CREATE VIEW servicos_pendentes_rota AS
-- Instalações: join em contrato ativo do veículo
SELECT i.id, 'instalacao'::text as tipo_servico, NULL::text as tipo_vistoria,
       i.bairro, i.cidade, i.cep, i.logradouro, i.numero,
       i.data_agendada, i.periodo, i.rota_id,
       a.id as associado_id, a.nome, a.telefone,
       v.id as veiculo_id, v.placa, v.marca, v.modelo
FROM instalacoes i
LEFT JOIN associados a ON a.id = i.associado_id
LEFT JOIN veiculos v ON v.id = i.veiculo_id
LEFT JOIN LATERAL (
  SELECT c.aprovado_em, c.origem_troca_titularidade_id
  FROM contratos c
  WHERE c.veiculo_id = i.veiculo_id
  ORDER BY c.created_at DESC LIMIT 1
) ct ON true
WHERE i.status IN ('agendada', 'reagendada')
  AND (ct.aprovado_em IS NOT NULL OR ct.origem_troca_titularidade_id IS NOT NULL OR ct.aprovado_em IS NULL AND ct.origem_troca_titularidade_id IS NULL AND NOT EXISTS (SELECT 1 FROM contratos c2 WHERE c2.veiculo_id = i.veiculo_id))
UNION ALL
-- Vistorias: join direto em vistorias.contrato_id (já existe na view atual)
SELECT vis.id, COALESCE(vis.origem,'vistoria')::text, vis.tipo::text,
       vis.endereco_bairro, vis.endereco_cidade, vis.endereco_cep,
       vis.endereco_logradouro, vis.endereco_numero,
       vis.data_agendada, NULL as periodo, vis.rota_id,
       COALESCE(vis.associado_id, l.associado_id),
       COALESCE(a.nome, l.nome),
       COALESCE(a.telefone, l.telefone),
       vis.veiculo_id,
       COALESCE(ve.placa, cot.veiculo_placa, ctr.veiculo_placa),
       COALESCE(ve.marca, cot.veiculo_marca, ctr.veiculo_marca),
       COALESCE(ve.modelo, cot.veiculo_modelo, ctr.veiculo_modelo)
FROM vistorias vis
LEFT JOIN associados a ON a.id = vis.associado_id
LEFT JOIN leads l ON l.id = vis.lead_id
LEFT JOIN veiculos ve ON ve.id = vis.veiculo_id
LEFT JOIN cotacoes cot ON cot.id = vis.cotacao_id
LEFT JOIN contratos ctr ON ctr.id = vis.contrato_id
WHERE vis.status IN ('pendente','em_analise')
  AND (
    vis.contrato_id IS NULL
    OR ctr.aprovado_em IS NOT NULL
    OR ctr.origem_troca_titularidade_id IS NOT NULL
  );
```

(Lógica do WHERE de instalações simplificada na implementação para: `contrato existe e (aprovado OU é troca) OU não há contrato vinculado ainda`.)

---

## Validação

1. **Caso KVV7538-like**: localizar/forjar contrato com `cadastro_aprovado=false`+`aprovado_em IS NULL`. Confirmar:
   - Não aparece em `/monitoramento/vistorias-instalacoes` aba Serviços (gate em `useServicos`).
   - Não aparece em Atribuídos, Rotas, Fila.
   - Rodar `aprovar-proposta` → reaparece em todas as telas.
2. **Trigger DB**: `INSERT INTO agendamentos_base (cotacao_id, ...)` com cotação cujo contrato tem `aprovado_em IS NULL` e `origem_troca_titularidade_id IS NULL` → erro `check_violation`.
3. **Exceção Troca**: contrato com `origem_troca_titularidade_id` setado e `aprovado_em IS NULL` → INSERT no `agendamentos_base` passa, serviço aparece em todas as 4 telas.
4. **Agendamento avulso** (sem `cotacao_id`) e **serviço sem `contrato_id`** continuam passando — sem regressão para fluxos legados/manutenção.

---

## Arquivos tocados

Frontend:
- `src/hooks/useServicos.ts` (select + filtro + tipo `Servico.contrato`)
- `src/hooks/useServicosAtribuidos.ts` (select + lookup contratos + filtro)
- `src/hooks/useFilaServicos.ts` (select aninhado + filtro)

Backend (1 migration):
- Função + trigger `trg_guard_agendamento_base_exige_cadastro_aprovado`
- `DROP/CREATE VIEW servicos_pendentes_rota` com filtro de aprovação

Sem alterações: `useServicosCampoUnificado.ts` (herda gate), `useServicosRota.ts` (lê da view atualizada).

---

## Memória a atualizar após implementar

Promover entrada Core para refletir que o gate Cadastro→Monitoramento agora é universal (5 hooks + trigger DB em `agendamentos_base`), com exceção única `origem_troca_titularidade_id`.
