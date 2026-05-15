## Diagnóstico (associado MARCUS VINICIUS / 988dbfa9 + veículo KOU6D37 / Ford Fiesta)

A troca `06037fb8-...` ficou `efetivada` mas deixou o estado inconsistente. Comparando as duas abas dos prints e o banco, encontrei **4 divergências reais**, todas causadas pela edge `efetivar-troca-titularidade` e pelo fluxo de aprovação da troca:

| # | Sintoma na UI | Realidade no banco | Causa raiz |
|---|---|---|---|
| 1 | Aba **Veículos** mostra "Cobertura Ativa"; aba **Resumo** mostra "Cobertura suspensa — troca_titularidade_em_andamento" | `veiculos.cobertura_suspensa=true`, motivo `troca_titularidade_em_andamento`, mas `solicitacoes_troca_titularidade.status='efetivada'` | `efetivar-troca-titularidade` (passo 6) atualiza `em_troca_titularidade=false` mas **não limpa** `cobertura_suspensa` / `cobertura_suspensa_motivo` / `cobertura_suspensa_em`. As duas abas leem campos diferentes (Veículos olha `status`, Resumo olha `cobertura_suspensa`) → divergência visível |
| 2 | (não visível, mas grave) Existem **2 contratos ATIVOS** para a mesma placa/associado | `06313261-...` (CTR-...WFIEBL, criado por `aprovar-proposta` durante o link público) e `a8e6e9b7-...` (TRC-20260515-7954, criado pelo reprocessamento manual) — ambos `status='ativo'`, mesmo `origem_troca_titularidade_id`, mesmo veículo, mesmo associado | `efetivar-troca-titularidade` (passo 7) faz INSERT cego sem checar se já existe contrato com `origem_troca_titularidade_id = solicitacao_id`. Viola a regra "1 contrato ativo por veículo" |
| 3 | Card mostra "Plano Select Basic / Mensalidade R$166,70" mas **Mensalidade: —** em "Vencimentos" | Novo contrato `a8e6e9b7` está `ativo` mas com `cadastro_aprovado=false` e `aprovado_em=NULL` — a régua de cobrança não emite mensalidade nesse estado | `efetivar-troca-titularidade` insere o contrato direto com `status='ativo'` sem passar pelo caminho canônico (`ativar-associado` + `cadastro_aprovado=true`). Viola a Core rule "Ativação centralizada" e "Cadastro nunca recebe `cadastro_aprovado=true` automaticamente, mas contrato ativo exige aprovação prévia" |
| 4 | SGA fica "pendente" para sempre | `sga_erro: "campo ESTADO do objeto associado é inválido"` — `associados.estado` do novo titular está NULL | `efetivar-troca-titularidade` cria o associado novo (linhas 297-309) sem copiar `endereco/estado/cidade/cep` do `novo_titular_dados` nem fazer fallback. Quando o cron `sga-hinova-sync` roda, falha eternamente |

## Plano de correção raiz

### 1. `supabase/functions/efetivar-troca-titularidade/index.ts`

**Idempotência de contrato (passo 7):** antes do INSERT do contrato novo, fazer SELECT em `contratos` por `origem_troca_titularidade_id = solicitacao_id` AND `status IN ('ativo','pendente')`. Se já existir, **reaproveitar** (UPDATE para refletir os dados atuais) em vez de inserir. Ao final, garantir que TODO contrato com `origem_troca_titularidade_id = solicitacao_id` que não seja o "vencedor" seja marcado `status='cancelado'` com `data_cancelamento=now`.

**Limpar suspensão do veículo (passo 6):** acrescentar ao UPDATE de `veiculos`:
```
cobertura_suspensa: false,
cobertura_suspensa_motivo: null,
cobertura_suspensa_em: null,
```
Isso elimina a divergência entre Resumo e Veículos.

**Cadastro aprovado no novo contrato (passo 7):** o contrato da troca já passou por aprovação de Cadastro + Monitoramento, então no INSERT/UPDATE incluir:
```
cadastro_aprovado: true,
aprovado_em: now,
aprovado_por: solicitacao.aprovado_monitoramento_por,
```
Isso libera a régua de cobrança a emitir a mensalidade do novo titular.

**Endereço do novo associado (passo 3):** ao criar novo associado, copiar `endereco/numero/complemento/bairro/cidade/estado/cep` do `novo_titular_dados` (vem do link público). Se ainda assim faltar `estado`, herdar do contrato anterior (`contratoAnterior.cliente_uf`) como fallback. Resolve o erro SGA persistente.

### 2. Reconciliação do caso atual (one-shot SQL via migration)

Para o associado 988dbfa9 / solicitação 06037fb8:
- Cancelar `06313261-c4c4-4a47-9a36-cf7875ff439e` (manter `a8e6e9b7-...` como vencedor) — `status='cancelado'`, `data_cancelamento=now`, `motivo_cancelamento='duplicidade_pos_troca_titularidade'`
- `UPDATE contratos SET cadastro_aprovado=true, aprovado_em=now, aprovado_por=<monitor>` no contrato vencedor
- `UPDATE veiculos SET cobertura_suspensa=false, cobertura_suspensa_motivo=NULL, cobertura_suspensa_em=NULL WHERE id='2315cece-...'`
- Preencher `associados.estado` (e demais campos de endereço se vazios) do 988dbfa9 a partir do link público / contrato anterior, depois disparar manualmente o `sga-hinova-sync` para aquele associado

### 3. Memória

Atualizar `mem://logic/sales/troca-titularidade-fluxo-canonico-e2e.md` (criada na rodada anterior) acrescentando 4 invariantes:
- "efetivar-troca-titularidade DEVE limpar `cobertura_suspensa` do veículo"
- "efetivar-troca-titularidade DEVE ser idempotente por `origem_troca_titularidade_id` — nunca cria 2º contrato"
- "Contrato pós-troca nasce com `cadastro_aprovado=true` (já passou por Cadastro+Monitoramento da troca)"
- "Novo associado da troca DEVE ter endereço completo copiado do link público antes de mandar pro SGA"

## Detalhes técnicos / arquivos tocados

- `supabase/functions/efetivar-troca-titularidade/index.ts` — passos 3, 6 e 7 (idempotência + cobertura + cadastro_aprovado + endereço)
- 1 migration SQL de reconciliação (apenas o caso travado)
- `mem://logic/sales/troca-titularidade-fluxo-canonico-e2e.md` — invariantes adicionais
- Sem mudança de schema, sem mudança de UI (a UI já está correta — o que está errado é o dado)

## Como vou validar

1. Após o fix, abrir a aba Resumo e Veículos → ambas devem mostrar "Cobertura Ativa" coerente
2. `SELECT count(*) FROM contratos WHERE origem_troca_titularidade_id='06037fb8...' AND status='ativo'` → deve retornar 1
3. `cobertura_suspensa` do KOU6D37 → false
4. `sga-hinova-sync` retry → `sga_status='sincronizado'` e códigos preenchidos
5. Vencimentos do Resumo passa a mostrar a próxima mensalidade

Sem efeito colateral em outros associados — a migration é escopada por id.