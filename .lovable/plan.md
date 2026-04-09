

## Plano: Serviços sem confirmação no mapa + botão de envio manual de confirmação WhatsApp

### Problema atual
1. A `view_vistorias_mapa` nao inclui `confirmacao_whatsapp`, `permite_encaixe` nem `periodo` — impossível distinguir visualmente serviços confirmados de nao confirmados
2. Nao existe botao para forçar envio de confirmacao WhatsApp manualmente
3. Serviços sem encaixe e sem confirmacao nao tem tratamento visual diferenciado

### Alteracoes

#### 1. Migration SQL — adicionar campos na view

Recriar `view_vistorias_mapa` adicionando 3 campos em cada UNION:
- `confirmacao_whatsapp` (da tabela `servicos`; NULL para vistorias e instalacoes legadas)
- `permite_encaixe` (da tabela `servicos`; false para vistorias e instalacoes legadas)
- `periodo` (da tabela `servicos`; NULL para vistorias, mapeado para instalacoes)

#### 2. Hook `useVistoriasMapa` — adicionar campos na interface

Adicionar `confirmacao_whatsapp`, `permite_encaixe` e `periodo` ao tipo `VistoriaMapa`.

#### 3. Hook `useEnviarConfirmacaoWhatsApp` — novo hook

Criar mutation que invoca a Edge Function `confirmar-vistorias-manha-cron` para um servico especifico, ou alternativamente invocar `whatsapp-send-text` diretamente com o template `confirmacao_manha_v1` e atualizar `confirmacao_whatsapp` no servico.

Abordagem mais simples: criar uma pequena Edge Function `enviar-confirmacao-manual` que:
- Recebe `servico_id`
- Busca dados do servico
- Envia template via `whatsapp-send-text`
- Atualiza `confirmacao_whatsapp = 'enviada'`
- Registra em `confirmacoes_agendamento`

#### 4. `MapaVistoriasContent.tsx` — mudancas visuais e funcionais

**Cores diferenciadas por data e confirmacao:**
- Servico de HOJE nao confirmado: cor laranja (`#F97316`)
- Servico de AMANHA ou futuro: cor amarela (`#EAB308`)
- Servico confirmado: cor verde (`#10B981`)
- Servico atrasado: cor vermelha (`#EF4444`) (ja existe)

**Tooltip permanente nos pins:**
- Mostrar tooltip fixo (usando `permanent: true` no Leaflet Tooltip) com data formatada e periodo (M/T)
- Cor do tooltip muda conforme `confirmacao_whatsapp`: cinza (nao enviado), amarelo (enviado/aguardando), verde (confirmado)

**Botao "Enviar Confirmação" no Popup:**
- Quando `atribuicaoManualAtiva` e servico nao é encaixe (`permite_encaixe = false`) e `confirmacao_whatsapp` é NULL ou nao confirmado
- Botao aparece no popup do pin e no card do sidebar
- Ao clicar, invoca `enviar-confirmacao-manual`
- Apos sucesso, tooltip muda de cor

**Legenda atualizada:**
- Adicionar itens para "Nao confirmado" (laranja) e "Confirmado" (verde)

#### 5. Edge Function `enviar-confirmacao-manual`

```typescript
// Recebe: { servico_id }
// 1. Busca servico com associado/cotacao para telefone
// 2. Envia whatsapp-send-text com template confirmacao_manha_v1
// 3. Atualiza servicos.confirmacao_whatsapp = 'enviada'
// 4. Insere em confirmacoes_agendamento
// 5. Retorna { success: true }
```

### Arquivos alterados
- **Nova migration SQL** — recriar `view_vistorias_mapa` com 3 campos extras
- **`src/hooks/useVistoriasMapa.ts`** — adicionar campos ao tipo
- **Nova Edge Function** `supabase/functions/enviar-confirmacao-manual/index.ts`
- **`src/components/mapa/MapaVistoriasContent.tsx`** — cores, tooltips permanentes, botao confirmacao, legenda

### Nao alterado
- `cron-atribuir-tarefas` — motor automatico continua igual
- `confirmar-vistorias-manha-cron` — cron de vespera/manha continua igual
- `whatsapp-webhook` — processamento de respostas continua igual

