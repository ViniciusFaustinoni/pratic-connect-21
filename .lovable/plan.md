

## Auditoria do fluxo de Prestadores Parceiros

Verifiquei rota a rota, banco, edge functions e mapa. Status real:

### ✅ O que está funcional

| Requisito | Status | Evidência |
|---|---|---|
| Recebe link via WhatsApp ao ser atribuído | ✅ | `gerar-link-vistoriador-prestador` e `gerar-link-prestador` invocam `whatsapp-send-text` com template Meta `prestador_nova_tarefa_v1` + fallback texto |
| URL pública expirável com token | ✅ | Rotas `/vistoria-prestador/:token` e `/prestador/instalacao/:token` registradas em `App.tsx` (442–447). Tabelas têm `expires_at` |
| Captura de localização ao abrir o link | ✅ | Ambas páginas usam `navigator.geolocation.watchPosition` com throttle de 30s gravando `latitude/longitude/precisao_metros/localizacao_atualizada_em` |
| Aparece no mapa de monitoramento | ✅ | `usePrestadoresAtivosMapa` lê as duas tabelas + realtime; `MapaVistoriasContent` renderiza marker + badge "PRESTADOR" |
| Rota / distância / tempo no mapa | ✅ | Quando `status ∈ {em_rota, em_execucao}` e há `destino_lat/lng`, usa `<RotaPolyline>` (mesmo componente dos técnicos internos) |
| Etapas Aceitar → Em rota → Em execução → Concluir | ✅ | Carimbos `aceito_em`, `em_rota_em`, `iniciada_em`, `chegada_em`, `concluida_em` em ambas tabelas |
| Vistoria com paridade ao app interno (checklist + fotos sequenciais + auto-save) | ✅ | `VistoriaPrestador.tsx` usa `ChecklistItem` e `VistoriaFotoSequencial` (mesmos componentes do `InstaladorChecklist`). Bucket `vistoria-prestador-fotos` público |
| Reenvio de link pelo popup do mapa | ✅ | Botão "Reenviar Link" no popup do prestador |

### ⚠️ Problemas encontrados (precisam correção)

**1. Bug no payload de reenvio para vistoria** — `MapaVistoriasContent.tsx` linha 895:
```ts
{ vistoria_id: p.instalacao_id, vistoriador_prestador_id: p.prestador_id }
```
A edge function `gerar-link-vistoriador-prestador` espera `instalacao_id`, não `vistoria_id`. **O reenvio falha hoje com erro 400** ("instalacao_id e vistoriador_prestador_id são obrigatórios").

**2. Paridade incompleta na instalação (`PrestadorInstalacao.tsx`)**
A página de **instalação** do prestador NÃO tem paridade com o app interno do instalador:
- Sem checklist estruturado (só upload de 1 foto livre).
- Sem `VistoriaFotoSequencial` (categorias obrigatórias).
- Sem auto-save parcial.
- Sem assinatura.

Já a página de **vistoria** (`VistoriaPrestador.tsx`) tem essa paridade — comportamento inconsistente entre os dois fluxos.

**3. Faltam campos no schema de `instalacao_prestador_links`** para suportar paridade total:
- `checklist_data jsonb`
- `fotos_vistoria jsonb`
- `assinatura_url text`
- `valor numeric`, `whatsapp_enviado boolean`, `whatsapp_erro text`
- `vistoriador_prestador_id` (atualmente usa `prestador_id` apontando para outra tabela `prestadores_assistencia`)

**4. URL pública**
A função `gerar-link-prestador` (instalação) usa `https://app.praticcar.org/prestador/instalacao/:token` ✅ (correto, conforme regra de domínio).
A função de vistoria usa `https://app.praticcar.org/vistoria-prestador/:token` ✅.

### 📋 Correções propostas

**Correção mínima (somente bugs):**
1. `MapaVistoriasContent.tsx` linha 894–897: trocar `vistoria_id` por `instalacao_id` no payload de reenvio para vistoria.

**Paridade completa (instalação ↔ app interno):**
2. Migração: adicionar colunas em `instalacao_prestador_links` (`checklist_data`, `fotos_vistoria`, `assinatura_url`, `valor`, `whatsapp_enviado`, `whatsapp_erro`, `vistoriador_prestador_id`, `aceito_em`, `recusado_em`, `recusa_motivo`, `em_rota_em`, `iniciada_em`).
3. Reescrever `PrestadorInstalacao.tsx` espelhando `VistoriaPrestador.tsx` (checklist + fotos sequenciais + auto-save + assinatura). Usar mesmos componentes do `InstaladorChecklist`.
4. Atualizar `gerar-link-prestador` para aceitar `valor`/`reenviar`/`atribuido_por` e fazer lançamento contábil + auditoria como o de vistoria.

### Pergunta

Confirme o escopo da próxima ação:

| Opção | Escopo |
|---|---|
| **A** | Corrigir só o bug do reenvio (item 1) — 5 min |
| **B** | Bug + paridade completa da instalação com app interno (itens 1-4) — refactor maior |

