
# Parte B — Correção arquitetural do fluxo de Inclusão

Objetivo: garantir que toda Inclusão siga o **mesmo pipeline da Nova Adesão** (Documentos → Assinatura → Pagamento/Isenção → Agendamento → Ativação), com **gate de débitos via SGA** e **hardening** para impedir novos casos como o do JOAO VICTOR (limbo: contrato assinado, sem agendamento, sem instalação, sem sync SGA).

---

## 1. Gate de débitos (SGA) — reforço no início

Já existe `useVerificarDebitosAssociado` (consome `sga-buscar-associado-completo`) e `useInclusaoBloqueioDebito`. O bloqueio já está em `OutrasEntradasMenu` e `DialogTipoOperacao`. Ações:

- Adicionar **double-check server-side** na edge `contrato-gerar` quando `tipo_entrada='inclusao'`: chamar `sga-buscar-associado-completo` pelo CPF do associado e **rejeitar (HTTP 409 `DEBITO_PENDENTE`)** se houver boletos abertos. Isso impede bypass via URL direta.
- Mensagem clara de bloqueio (lista boletos + saldo) — UI já renderiza via `DebitosCard`, ok.
- Negociação de débito: **fora de escopo** desta entrega (placeholder de mensagem "Negociação em breve").

## 2. Fluxo público idêntico ao da Nova Adesão

O fluxo público `/c/:slug` (CotacaoContratacao) hoje só roda integralmente quando `valor_adesao > 0`. Para Inclusão precisamos garantir as **5 etapas sempre**:

```text
Plano (já escolhido) → Documentos → Contrato → Agendamento → Pagamento/Isenção → Ativação
```

Mudanças:

- `CotacaoContratacao.tsx`: quando `cotacao.tipo_entrada === 'inclusao'`, **forçar exibição da Etapa Agendamento** mesmo se `valor_adesao = 0` (hoje a etapa é pulada porque o gatilho de ativação está atrelado ao pagamento).
- Em adesão isenta (valor 0) na inclusão: substituir a etapa "Pagamento" por uma etapa **"Confirmação de Isenção"** (botão único "Confirmar inclusão") que dispara o mesmo handler de pós-pagamento.
- Persistência por etapa já é resiliente (memory: `public-flow-resilience`), aproveitar.

## 3. Hardening da edge `criar-instalacao-pos-pagamento`

Hoje a função **não valida** se há agendamento antes de criar a instalação, e não é chamada quando `valor_adesao=0`. Mudanças:

- Validar antes de criar instalação:
  ```ts
  if (!cotacao.vistoria_data_agendada || !cotacao.vistoria_endereco_logradouro) {
    return 422 { code: 'AGENDAMENTO_AUSENTE' }
  }
  ```
- Após criar instalação + serviço, **chamar `ativar-associado`** (memória `single-source-activation`) em cadeia para fechar o ciclo de ativação para inclusões com adesão isenta.
- Log estruturado em `logs_operacionais` com `etapa`, `cotacao_id`, `tipo_entrada`.

## 4. Trigger/auto-cura do gatilho de Inclusão isenta

Adicionar trigger em `contratos` (AFTER UPDATE de `assinado_em`) que, quando:
- `tipo_entrada='inclusao'` AND `valor_adesao=0` AND `vistoria_data_agendada IS NOT NULL`

→ enfileira chamada (via `pg_net` ou tabela de fila já existente) para `criar-instalacao-pos-pagamento` com `skipPaymentCheck=true`.

Isso garante que mesmo se a UI falhar, o backend conclui o processo.

## 5. Detecção e relatório de "limbos" existentes

Criar view `vw_cotacoes_em_limbo` para o painel de operação:

```sql
CREATE VIEW vw_cotacoes_em_limbo AS
SELECT c.id, c.numero, c.tipo_entrada, c.associado_id, ct.assinado_em,
       c.vistoria_data_agendada,
       (SELECT count(*) FROM instalacoes i WHERE i.cotacao_id = c.id) AS qtd_instalacoes
FROM cotacoes c
JOIN contratos ct ON ct.cotacao_id = c.id
WHERE ct.assinado_em IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM instalacoes i WHERE i.cotacao_id = c.id);
```

Usar isso para varrer histórico e tratar manualmente os casos antigos. **Sem UI nova** nesta entrega — só a view (operação consulta direto).

---

## Resumo dos arquivos a alterar

- `supabase/functions/contrato-gerar/index.ts` — gate server-side de débito para inclusão.
- `supabase/functions/criar-instalacao-pos-pagamento/index.ts` — validação de agendamento + chain `ativar-associado`.
- `src/pages/public/CotacaoContratacao.tsx` — forçar etapa de agendamento + tela de "Confirmar inclusão" para isentos.
- Migration: trigger em `contratos` para inclusão isenta + view `vw_cotacoes_em_limbo`.

## Fora de escopo

- Tela/fluxo de **negociação** de débito (próxima fase).
- UI de painel de limbos (só view SQL por enquanto).

Confirma para implementar?
