# Remover jornada legada `/q/:token` (CotacaoPublicaCompleta)

## Evidência coletada

| Indicador | Resultado |
|---|---|
| Tabela `cotacoes_publicas` (DB) | **0 registros** — nenhum link `/q/` ativo no mundo real |
| Rota `/q/:token` em App.tsx | Existe (linha 442) — única consumidora da página |
| Geradores de link `/q/${token}` | 2 pontos vivos: `LeadDetalhe.tsx:177` e `new-lead-flow/SuccessStep.tsx:17` (ambos gravam em `cotacoes_publicas`) |
| Página `CotacaoPublicaCompleta.tsx` | Importada **só** de App.tsx |
| Hook `useCotacaoPublica` + `useCriarCotacaoPublica` | Consumidos só por `CotacaoPublicaCompleta`, `LeadDetalhe`, `SuccessStep` e `useNewLeadFlow` |
| Type `StatusCotacaoPublica` | Usado só dentro de `types/cotacaoPublica.ts` e da página morta |
| `useCalcularCotacao` | **Compartilhado** com `substituicao/StepFinanceiro.tsx` e `substituicao/StepBeneficios.tsx` → **NÃO deletar** |
| Tabelas DB associadas | `cotacoes_publicas`, `cotacoes_publicas_historico`, `cotacoes_publicas_fotos` |

**Conclusão:** jornada morta. Como `cotacoes_publicas` está vazia, não há cliente em campo dependendo dela. Remoção é segura, sem necessidade de redirect `/q/ → /cotacao/`.

## Escopo da remoção

### Front-end (deletar)
- `src/pages/public/CotacaoPublicaCompleta.tsx`
- `src/types/cotacaoPublica.ts`
- `src/hooks/useCotacaoPublica.ts`
- Rota e import lazy em `src/App.tsx` (linhas 41 e 442)

### Front-end (substituir geradores de link)
- `LeadDetalhe.tsx`: remover botão "Gerar link de cotação" e todos os handlers/states associados (`criarCotacaoPublica`, `linkCotacao`, `setLinkCopiado`, `handleCopiarLink`, `handleEnviarLinkWhatsApp`, `setLinkCotacao`). O fluxo canônico de gerar link agora é via cotação propriamente dita (`CotacaoFormDialog` + `/cotacao/:token`).
- `new-lead-flow/SuccessStep.tsx`: remover o bloco de link público `/q/`. A tela de sucesso de novo lead vira **só** "lead criado, agora gere uma cotação para enviar link" — sem auto-gerar `cotacoes_publicas`.
- `useNewLeadFlow.ts:368`: remover o insert em `cotacoes_publicas` e o retorno de `token`. Ajustar a interface para não emitir mais `token`.

### Hooks compartilhados (PRESERVAR)
- `useCalcularCotacao` — usado por `substituicao/StepFinanceiro` e `StepBeneficios`. **Manter intacto.** É dívida técnica separada (ERRO futuro: `tabelas_preco_mensalidade` em StepFinanceiro/Beneficios), fora do escopo deste ticket.

### Banco de dados
Tabelas vazias (0 registros). DROP seguro em migration:

```sql
DROP TABLE IF EXISTS public.cotacoes_publicas_fotos CASCADE;
DROP TABLE IF EXISTS public.cotacoes_publicas_historico CASCADE;
DROP TABLE IF EXISTS public.cotacoes_publicas CASCADE;
```

> Confirmar antes: nenhum trigger/edge function externa as referencia. (Verificarei `supabase/functions` antes da migration; se houver consumidor, ajusto.)

## Validação após remoção

1. `tsc` limpo (typegen do Supabase regenerado deixará de exportar `cotacoes_publicas*`).
2. `rg "cotacoes_publicas|StatusCotacaoPublica|CotacaoPublicaCompleta|/q/"` deve voltar vazio.
3. Fluxo "Novo Lead" funciona até a tela de sucesso sem botão de link (lead salvo no DB).
4. Tela de detalhe do lead funciona sem botão "Gerar link de cotação".
5. Vendedor envia link para cliente via `CotacaoFormDialog` → `/cotacao/:token` (caminho canônico já existente).

## Fora de escopo

- Refatorar `useCalcularCotacao` ou eliminar `tabelas_preco_mensalidade` no fluxo de Substituição (dívida separada já registrada na Core memory).
- Mudar UX do "Novo Lead" além de remover o link. Discussão sobre encadear `CotacaoFormDialog` a partir do SuccessStep fica para outro ticket — aqui só removemos a jornada morta.

## Risco

Baixo. `cotacoes_publicas` zerado em produção = nenhum cliente em fluxo. Único risco residual: edge function ou cron escondida que escreve em `cotacoes_publicas`. Verifico em `supabase/functions/` antes de rodar a migration; se houver, abro decisão.

Aprovado para executar?
