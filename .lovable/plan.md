


# Plano: Link Tokenizado para Prestador com WhatsApp Meta

## Resumo

Link publico tokenizado para prestadores confirmarem chegada e conclusao de instalacoes com foto. Envio via WhatsApp Meta API. Acompanhamento no drawer do coordenador.

---

## PARTE 1 — Tabela + Storage (Migration) ✅

- Tabela `instalacao_prestador_links` com token, status, timestamps, foto
- Bucket `prestador-fotos` publico
- RLS: anon SELECT/UPDATE, authenticated ALL
- Template Meta `prestador_nova_instalacao_v1` (DRAFT)

## PARTE 2 — Edge Function `gerar-link-prestador` ✅

- Gera token, busca dados, envia WhatsApp via `whatsapp-send-text`
- Retorna token e URL

## PARTE 3 — Pagina Publica `/prestador/instalacao/:token` ✅

- Mobile-first, sem autenticacao (publicSupabase)
- Confirmar chegada → em_execucao
- Upload foto + concluir → concluida

## PARTE 4 — Secao Prestador no InstalacaoDetailDrawer ✅

- Badge status, horarios, foto comprovante
- Botoes "Copiar Link" e "Reenviar"

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| DB migration | Tabela + bucket + template |
| `supabase/functions/gerar-link-prestador/index.ts` | Nova edge function |
| `src/pages/public/PrestadorInstalacao.tsx` | Nova pagina publica |
| `src/App.tsx` | Rota + import |
| `src/components/instalacoes/InstalacaoDetailDrawer.tsx` | Secao prestador |
