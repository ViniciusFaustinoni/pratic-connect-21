

# Ajustes de Regra de Negócio no Módulo de Migração

## Resumo dos 4 ajustes

1. **Prazo de antiguidade dos comprovantes** — validar data máxima (configurável)
2. **Declaração de cancelamento na concorrente** — checkbox obrigatório + coluna no banco
3. **Remover bloqueio por débitos** — só manter bloqueio por vínculo ativo
4. **Sem limite de migrações** — já confirmado que não existe nenhum limite no código

---

## Detalhamento técnico

### Migração de banco (1 migration)

```sql
-- Ajuste 1: novo parâmetro configurável
INSERT INTO comissoes_parametros (chave, valor, ativo)
VALUES ('migracao_prazo_max_comprovante_meses', '3', true)
ON CONFLICT (chave) DO NOTHING;

-- Ajuste 2: nova coluna na solicitação
ALTER TABLE solicitacoes_migracao
ADD COLUMN IF NOT EXISTS declaracao_cancelamento_concorrente boolean DEFAULT false;
```

### Arquivos modificados

| Arquivo | Ajuste | O que muda |
|---------|--------|------------|
| `src/components/gestao-comercial/RegrasVendaContent.tsx` | 1 | Novo campo "Prazo máximo de antiguidade dos comprovantes em meses" na aba Migração |
| `src/components/contratos/MigracaoStepForm.tsx` | 1, 2, 3 | Validação de data dos comprovantes; checkbox de declaração; remover bloqueio por débitos |
| `src/components/cadastro/MigracaoDiretaDialog.tsx` | 1, 2, 3 | Mesmas alterações no formulário de entrada direta |
| `src/hooks/useSolicitacaoMigracao.ts` | 2, 3 | Adicionar campo `declaracao_cancelamento_concorrente` no insert; remover verificação de débitos do `useVerificarBloqueiosMigracao` |
| `src/hooks/useConteudosSistema.ts` | 1 | Adicionar `prazo_max_comprovante_meses` ao `useMigracaoConfig` |
| `src/pages/cadastro/SolicitacoesMigracao.tsx` | 2 | Exibir indicador de declaração de cancelamento na fila de aprovação |

### Ajuste 1 — Prazo de antiguidade

- Novo parâmetro `migracao_prazo_max_comprovante_meses` na tabela `comissoes_parametros` (valor padrão: 3)
- Expor no `useMigracaoConfig` como `prazo_max_comprovante_meses`
- Na aba Migração do `RegrasVendaContent`, adicionar campo numérico com label "Prazo máximo de antiguidade dos comprovantes (meses)"
- Na validação de `MigracaoStepForm` e `MigracaoDiretaDialog`, após OCR extrair a data do documento, comparar com `hoje - X meses`. Se fora do prazo, rejeitar com mensagem: "Comprovante fora do prazo aceito (máximo X meses)"
- Como o OCR pode não retornar data, a validação será melhor-esforço: se data detectada e fora do prazo → erro; se não detectada → passa (a equipe interna valida manualmente na fila)

### Ajuste 2 — Checkbox de cancelamento

- Nova coluna `declaracao_cancelamento_concorrente` (boolean, default false) na tabela `solicitacoes_migracao`
- Nos formulários `MigracaoStepForm` e `MigracaoDiretaDialog`, adicionar Checkbox com texto: "Declaro que o associado está cancelando ou já cancelou o vínculo com a associação anterior"
- Botão de envio fica desabilitado enquanto checkbox não estiver marcado
- O valor é salvo na solicitação via mutations existentes
- Na fila de aprovação (`SolicitacoesMigracao.tsx`), exibir badge ou ícone indicando se a declaração foi feita

### Ajuste 3 — Remover bloqueio por débitos

- No `useVerificarBloqueiosMigracao` (useSolicitacaoMigracao.ts), remover o bloco de verificação de débitos (linhas 43-67). Manter apenas a verificação de vínculo ativo
- Remover referência a `tipo: 'debito'` da interface `BloqueioResult`
- Nos componentes, o alerta de "Débitos Pendentes" deixa de aparecer naturalmente

### Ajuste 4 — Sem limite de migrações

Confirmado: não existe nenhuma verificação de quantidade de migrações por CPF no código. Nenhuma alteração necessária.

