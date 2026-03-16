

## Auditoria Completa: Fluxo de Despacho de Reboque

### Resultado por item solicitado

---

**1. A IA envia mensagem para todos os reboquistas informando que há um chamado**
- **STATUS: IMPLEMENTADO** -- `despacho-reboque-disparar` busca todos os prestadores ativos com `tipos_servico` compatível, filtra os que têm WhatsApp, remove os ocupados, e envia mensagem individual via `whatsapp-send-text`.

**2. Na mensagem contém dados do chamado**
- **STATUS: IMPLEMENTADO** -- A mensagem inclui: tipo de serviço, veículo (marca/modelo/placa), observações, endereço origem/destino, e valor sugerido quando disponível. Pede resposta "SIM" ou "NÃO".

**3. A IA aguarda até 10 minutos ou 3 respostas**
- **STATUS: PARCIALMENTE** -- O `despacho-reboque-responder` dispara atribuição imediata quando atinge **10 aceites** (não 3). O limite de tempo é **1 hora** (não 10 minutos). Existe um cron que chama `despacho-reboque-atribuir` quando o tempo expira, mas o threshold está em 1h.
- **CORREÇÃO NECESSÁRIA**: Alterar para 10 minutos de limite + 3 aceites como trigger de atribuição imediata (em vez de 10).

**4. Atribui automaticamente o mais em conta, respeitando valor sugerido**
- **STATUS: PARCIALMENTE** -- A atribuição (`despacho-reboque-atribuir`) seleciona o aceite de menor `valor_calculado`. Porém, **NÃO valida se o valor é <= valor_sugerido** do prestador. Aceita qualquer valor.
- **CORREÇÃO NECESSÁRIA**: Adicionar filtro que rejeita aceites com `valor_calculado > valor_sugerido` (quando valor_sugerido existir).

**5. Envia contato do prestador ao associado e do associado ao prestador**
- **STATUS: PARCIALMENTE** -- O `despacho-reboque-atribuir` envia WhatsApp ao associado com nome do prestador, telefone e link de acompanhamento. Porém, **NÃO envia os dados do associado ao prestador** (nome, telefone, endereço).
- **CORREÇÃO NECESSÁRIA**: Adicionar envio de WhatsApp ao prestador vencedor com dados do associado.

---

**6. Badges dinâmicos na tela do analista**
- **STATUS: NÃO IMPLEMENTADO** -- A `ChamadosList.tsx` não tem o status `aguardando_aceites` no `statusConfig` (linha 79-88) nem no `statusOptions` (linha 50-58). Não existe badge dinâmico com atualização automática mostrando "Contactando Prestadores" → "Aguardando Orçamentos" → "Chamado Urgente" (piscando).
- **CORREÇÃO NECESSÁRIA**: 
  - Adicionar `aguardando_aceites` ao statusConfig e statusOptions
  - Criar componente de badge dinâmico com realtime que mostra a fase atual baseado em `despacho_reboque.status` e `despacho_reboque.hora_limite`
  - Badge "CHAMADO URGENTE" piscando quando despacho expirou sem atribuição
  - Badge "ATRIBUÍDO" verde + "EM ANDAMENTO" quando atribuído

**7. Conclusão pelo analista com fotos e vídeo**
- **STATUS: PARCIALMENTE** -- Fotos do reboquista são suportadas (upload de até 20 fotos JPG/PNG, com momentos "chegada/carregamento/entrega"). Porém, **upload de vídeo NÃO é suportado** (aceita apenas `image/jpeg, image/png, image/webp`).
- **CORREÇÃO NECESSÁRIA**: Adicionar suporte a vídeo (MP4/WebM) no `FotosReboquistaUploadModal`.

---

### Plano de Implementação

**Etapa 1: Corrigir parâmetros de despacho**
- `despacho-reboque-disparar`: mudar `hora_limite` de 1h para 10min
- `despacho-reboque-responder`: mudar trigger de 10 aceites para 3 aceites

**Etapa 2: Validar valor_sugerido na atribuição**
- `despacho-reboque-atribuir`: filtrar aceites onde `valor_calculado <= valor_sugerido` (quando valor_sugerido existe no convite). Se nenhum se enquadra, marcar como expirado/urgente.

**Etapa 3: Enviar dados do associado ao prestador vencedor**
- `despacho-reboque-atribuir`: após atribuição, enviar WhatsApp ao prestador com nome, telefone e endereço do associado.

**Etapa 4: Badges dinâmicos na ChamadosList**
- Adicionar `aguardando_aceites` ao statusConfig/statusOptions
- Criar componente `BadgeDespachoStatus` que consulta `despacho_reboque` em tempo real
- Fases: "Contactando Prestadores" (amarelo) → "Aguardando Orçamentos" (amber) → "Chamado Urgente" (vermelho piscando) → "Atribuído" (verde) + "Em Andamento"
- Usar Supabase Realtime na tabela `despacho_reboque`

**Etapa 5: Suporte a vídeo no upload**
- `FotosReboquistaUploadModal`: adicionar `video/mp4, video/webm` ao accept e ajustar limite de tamanho para vídeos (50MB)

