## Objetivo
Reescrever a etapa de fotos do link público de vistoria (`VistoriaPublica.tsx → EtapaFotos`) para ter **a mesma estrutura** do app do instalador (`ExecutarVistoriaCompleta.tsx`), mantendo:
- Tema **claro** (não dark como no app)
- **Sem botões de Aprovar/Reprovar** (apenas envio → "aguardando aprovação")
- Mesmas validações e recursos avançados

## Estrutura final da tela pública

Igual ao app do instalador, na seguinte ordem:

```text
┌─────────────────────────────────────────────┐
│ Header: Voltar  +  Nome cliente | Placa     │
│         (sem botões WhatsApp/Telefone)      │
├─────────────────────────────────────────────┤
│ Barra de progresso fixa: X/Y fotos          │
├─────────────────────────────────────────────┤
│ ▸ Card "Quem está realizando?"              │
│   - Nome do executor (input livre)          │
│                                             │
│ ▸ Card "Conferência de Dados"               │
│   - Checkbox: Placa, Chassi, Modelo, Cor    │
│   - Input: Hodômetro (km) — obrigatório     │
│                                             │
│ ▸ Card "Fotos da Vistoria"                  │
│   - VistoriaFotoSequencial (mesmo do app)   │
│                                             │
│ ▸ Card "Vídeo 360°"                         │
│   - VideoCapture                            │
│                                             │
│ ▸ Card "Observações (opcional)"             │
│   - Textarea                                │
├─────────────────────────────────────────────┤
│ Footer fixo:                                │
│ [ Finalizar envio para aprovação ]          │
│ Indicador: rascunho salvo / fila offline    │
└─────────────────────────────────────────────┘
```

## Recursos a implementar

### 1. Conferência de dados + hodômetro
- Card com 4 checkboxes (placa, chassi, modelo, cor) buscando dados do veículo já carregado.
- Input numérico de hodômetro (obrigatório para finalizar).
- Adicionar à validação `podeFinalizar`.

### 2. Barra de progresso de fotos
- Componente fixo no topo (logo abaixo do header) mostrando `totalFotosEnviadas / totalFotosObrigatorias`.
- Usa `getTotalFotosObrigatorias(tipoVeiculo)` igual ao app — número dinâmico por tipo de veículo, em vez do mínimo fixo de 10 atual.

### 3. Auto-save de rascunho

Adicionar a `vistoria_links` colunas para guardar o rascunho do executor público:
- `fotos_rascunho_executor_nome` (text)
- `fotos_rascunho_conferencia` (jsonb) — checkboxes
- `fotos_rascunho_hodometro` (text)
- `fotos_rascunho_observacoes` (text)
- `fotos_rascunho_atualizado_em` (timestamptz)

Edge function nova: `salvar-rascunho-vistoria-publica` (recebe `token` + dados, atualiza colunas). RLS continua negando acesso direto à tabela — só via edge function.

Hook React com debounce de 2s (mesmo padrão do app).

### 4. Fila offline para uploads (origem=`publico`)
O `useSyncQueue` atual só funciona para usuários logados. Para a rota pública:
- Estender `MidiaPendente.origem` para aceitar `'publico'`.
- Adicionar campo opcional `token` (do link) em `MidiaPendente`.
- No `useSyncQueue`, novo branch `origem === 'publico'` que:
  - Não usa `supabase.auth.getSession()`.
  - Faz upload via `publicSupabase` para o bucket `vistoria-prestador-fotos` (já usado).
  - Usa o `token` para reconstruir o path `${token}/fotos/${slot}.jpg`.
- Novo hook `useUploadVistoriaPublicaOffline(token)` análogo ao `useUploadVistoriaOffline`, com `enfileirarFoto` / `enfileirarVideo` específicos.
- Componente reutilizável `OfflineQueueIndicator` (ou inline, igual ao existente) mostrando "X mídia(s) pendentes".

### 5. Status "aguardando aprovação"
Ao finalizar, o backend já marca `fotos_etapa_status='concluida'` e o gating do monitoramento já existe (essa parte não muda). Apenas confirmar que o estado visual reflete claramente "Enviado — aguardando aprovação do monitoramento" depois de finalizar.

## O que NÃO entra (decisões já confirmadas)

- ❌ Tema dark (mantém claro).
- ❌ Botões "Aprovar" / "Reprovar" (a aprovação fica com o monitoramento).
- ❌ Botões WhatsApp/Telefone do associado no header (essa tela é pública, não para o técnico).
- ❌ Temporizador de execução (descartado).

## Arquivos a tocar

**Backend (migration + edge function nova):**
- Migration: adicionar colunas de rascunho em `vistoria_links`.
- `supabase/functions/salvar-rascunho-vistoria-publica/index.ts` — nova.

**Frontend:**
- `src/lib/offline/db.ts` — adicionar `'publico'` em `origem` e campo `token`.
- `src/hooks/useSyncQueue.ts` — novo branch para origem pública.
- `src/hooks/useUploadVistoriaPublicaOffline.ts` — novo.
- `src/hooks/useVistoriaLinkPublica.ts` — adicionar `useSalvarRascunhoVistoriaPublica` (mutation com debounce).
- `src/pages/public/VistoriaPublica.tsx` — refatorar `EtapaFotos`:
  - Adicionar conferência + hodômetro
  - Adicionar barra de progresso fixa
  - Trocar uploads diretos pela fila offline
  - Adicionar auto-save de rascunho
  - Restaurar rascunho ao abrir
  - Usar `getTotalFotosObrigatorias` em vez de mínimo fixo

## Ordem de execução
1. Migration das colunas de rascunho.
2. Edge function `salvar-rascunho-vistoria-publica`.
3. Estender `db.ts` e `useSyncQueue.ts` para origem pública.
4. Hooks de offline + rascunho público.
5. Refatorar `EtapaFotos`.
6. QA: gerar link, abrir em janela anônima (sem login), enviar fotos com auto-save, validar que aparecem em "aguardando aprovação" no monitoramento.

