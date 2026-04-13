
## Plano: Template com URL do sistema + Aprovação via painel

### Problema
1. O template Meta `aprovacao_fipe_diretoria_v2` não inclui a URL do sistema para o diretor acessar o painel
2. A página de Aprovações (`/vendas/aprovacoes-fipe`) não exibe as aprovações da diretoria (tabela `aprovacoes_fipe_diretoria`) -- só mostra as do analista (`aprovacoes_fipe_limite`)
3. A aprovação/recusa via painel não está implementada

### Solução

**1. Atualizar template Meta e reenviar**
- Alterar corpo do template para incluir a URL `https://app.praticcar.org/vendas/aprovacoes-fipe` como texto (não como botão URL, pois o botão já existe)
- Atualizar fallback de texto livre no `notificar-diretoria-fipe` para incluir o link
- Deletar o template antigo na Meta (via API DELETE) e recriar com o novo corpo via `whatsapp-submit-template`
- Migration para atualizar o registro na tabela `whatsapp_meta_templates`

**2. Adicionar aba "Diretoria" na página de Aprovações**
- Novo `SectionTab`: `'diretoria'` ao lado de FIPE Menor / Alto Valor / Elegibilidade
- Novo hook `useAprovacoesDiretoria(status?)` que busca da tabela `aprovacoes_fipe_diretoria` com join em `cotacoes` para dados do veículo/associado
- Cards exibindo: dados do veículo, valor FIPE, limite, categoria, associado, votos já registrados
- Botoes Aprovar/Recusar que atualizam `aprovacoes_fipe_diretoria` e verificam se atingiu o mínimo de votos

**3. Hook `useAprovacoesDiretoria`**
- Busca `aprovacoes_fipe_diretoria` filtrada por `diretor_id = auth.uid()` ou todos (se admin)
- Join com `cotacoes` para pegar dados do veículo e associado
- Mutations para aprovar/recusar que:
  - Atualizam o registro individual (`status`, `respondido_em`)
  - Contam total de aprovações para a cotação
  - Se >= mínimo configurado: atualizam `cotacoes.fipe_diretoria_aprovado = true`

**4. RLS: permitir diretores atualizarem seus próprios registros**
- Adicionar policy UPDATE em `aprovacoes_fipe_diretoria` para `diretor_id = auth.uid()`

### Escopo
- 1 migration (atualizar template + RLS policy)
- 1 novo hook (`useAprovacoesDiretoria`)
- 1 arquivo editado (`AprovacoesFipeMenor.tsx` - adicionar aba Diretoria)
- 2 Edge Functions editadas (`notificar-diretoria-fipe` fallback com URL, `whatsapp-submit-template` resubmissão)
