## Objetivo
Corrigir dois bugs que fazem associados (como RAFAEL) aparecerem com badge incorreto "Aguard. Doc" em Propostas Pendentes mesmo com toda documentação aprovada e SGA sincronizado, e backfillar os casos travados.

## Bug 1 — `associados.status` não avança ao aprovar o último documento

### Causa
Não existe trigger/edge promovendo o associado de `documentacao_pendente` para `em_analise` quando o último `contratos_documentos` (ou `documentos_solicitados`) muda para `aprovado`. Hoje o status só é alterado em fluxos manuais.

### Correção
Criar **trigger** em `contratos_documentos` (AFTER UPDATE de `status`) que:
1. Lê o `cotacao_id` afetado, descobre o `associado_id` via `contratos`.
2. Se **não houver mais documentos** com `status IN ('em_analise','enviado','pendente')` e existir pelo menos um `aprovado`, e `associados.status='documentacao_pendente'`, promove para:
   - `em_analise` se ainda houver vistoria/instalação pendente, **ou**
   - mantém regra existente para outros caminhos (`pendente_vistoria` quando `tipo_vistoria` requer execução).
3. Replicar a mesma lógica em `documentos_solicitados` (AFTER UPDATE).

### Backfill (migração SQL única)
```sql
UPDATE associados a
SET status = 'em_analise', updated_at = now()
WHERE a.status = 'documentacao_pendente'
  AND NOT EXISTS (
    SELECT 1 FROM contratos c
    JOIN contratos_documentos cd ON cd.cotacao_id = c.cotacao_id
    WHERE c.associado_id = a.id
      AND cd.status IN ('em_analise','enviado','pendente')
  )
  AND NOT EXISTS (
    SELECT 1 FROM documentos_solicitados ds
    WHERE ds.associado_id = a.id
      AND ds.status IN ('pendente','enviado')
  );
```

## Bug 2 — Badge errado quando docs aprovados mas vistoria/instalação pendente

### Correção em `src/pages/cadastro/PropostasPendentes.tsx` (função `getStatusBadge`)
Substituir a lógica `aguardandoDoc` para diferenciar:
- **`Aguard. Doc`** (laranja) — só quando `temDocPendente === true` **ou** existem documentos solicitados pendentes não enviados.
- **`Aguard. Vistoria`** (roxo) — quando todos docs aprovados, contrato `assinado`, plano com R&F, e ainda não há vistoria concluída/aprovada.
- **`Aguard. Instalação`** (azul) — vistoria aprovada mas instalação não concluída.
- Demais badges existentes inalterados.

A função recebe `instalacaoInfo` e `tipoEtapa`; vamos receber também `temVistoriaConcluida` (já disponível em `vistoria.status`) e `planoTemRouboFurto` (já no `PropostaPendente`).

### Ajuste no header da proposta
`PropostaHeroHeader` (chip "Aguardando docs do cliente" da imagem) usa o mesmo critério — corrigir lá também para refletir o estado real.

## Bug 3 (relacionado) — Autovistoria nunca iniciada para Rafael

Caso pontual: gerar/reenviar o link público de autovistoria via `gerar-link-vistoria-publica` para o contrato `f52bcb6f-7b28-46a8-ae74-d00c877c3671`. Isso destrava a cobertura.

## Garantia da regra solicitada
A listagem de Propostas Pendentes **continua exibindo**:
- Associados com plano sem R&F enquanto contrato `assinado` e cadastro não promovido para `ativo`.
- Associados pendentes de aprovação de cadastro.

Nenhum filtro de listagem é alterado — apenas rótulos e o avanço automático de status.

## Detalhes técnicos
- Arquivos a editar:
  - `supabase/migrations/<novo>.sql` (trigger + backfill)
  - `src/pages/cadastro/PropostasPendentes.tsx` (badge)
  - `src/components/cadastro/proposta/PropostaHeroHeader.tsx` (chip "Aguardando docs do cliente")
- Sem mudanças em RLS.
- Sem mudanças no filtro `status='assinado'` da query principal.

## Validação pós-deploy
1. Backfill move RAFAEL e demais casos travados para `em_analise`.
2. UI passa a mostrar "Aguard. Vistoria" no card do RAFAEL.
3. Próxima aprovação de documento promove automaticamente o associado.
