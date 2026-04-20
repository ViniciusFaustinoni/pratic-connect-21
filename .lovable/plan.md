

## Atribuição Manual a Técnicos Prestadores

### Contexto
Hoje a aba "Atribuição Manual" e o mapa só permitem arrastar/atribuir serviços a técnicos internos (com turno aberto e localização ativa). Prestadores externos só podem ser atribuídos manualmente via drawer da instalação (`PainelAtribuicaoPrestador`). O usuário quer unificar isso: o coordenador deve poder, na mesma interface, escolher entre técnico interno ou prestador, e ao atribuir a prestador, ver um botão "Copiar Link" (sem envio automático de template WhatsApp).

### Arquivos tocados

**1. `src/components/monitoramento/AtribuicaoManualTab.tsx`**
- Adicionar seção "Prestadores" no painel direito, abaixo dos "Vistoriadores Ativos", listando prestadores ativos da tabela `vistoriadores_prestadores` (reutilizar `useVistoriadoresPrestadores`).
- Cada prestador é um `DroppableVistoriador` adaptado (novo componente `DroppablePrestador`) — aceita drag-and-drop.
- Ao soltar um serviço em um prestador, o dialog de confirmação muda: mostra campo "Valor (R$)" e identifica como "Prestador Externo". O botão de confirmar gera o link e mostra o resultado com botão "Copiar Link".

**2. `src/hooks/useAtribuicaoManual.ts`**
- Novo mutation `useAtribuirServicoPrestador` que:
  1. Busca `instalacao_origem_id` do `servico` (para serviços tipo `instalacao`). Para outros tipos, busca via `vistoria_origem_id` → `vistorias.instalacao_id` ou cria link direto.
  2. Invoca a edge function `gerar-link-vistoriador-prestador` (para vistorias) ou `gerar-link-prestador` (para instalações) passando `instalacao_id`, `vistoriador_prestador_id`, `valor`, `atribuido_por`.
  3. Retorna `{ token, url }` para o UI mostrar o botão "Copiar Link".
  4. Registra no `servicos_atribuicoes_log` com `tipo_atribuicao: 'manual_prestador'`.

**3. Edge Functions `gerar-link-prestador` e `gerar-link-vistoriador-prestador`**
- Adicionar parâmetro opcional `skip_whatsapp: true`. Quando presente, pula o envio de WhatsApp (ações 3/AÇÃO 3) e retorna o link normalmente. Isso permite que o coordenador copie o link manualmente sem disparar template via Meta.
- O restante do fluxo (criação do link, auditoria, financeiro) permanece igual.

**4. `src/components/monitoramento/AtribuicaoManualTab.tsx` — Dialog de resultado**
- Após atribuição a prestador, um segundo dialog aparece com:
  - URL do prestador
  - Botão "Copiar Link" (usa `navigator.clipboard`)
  - Botão "Abrir no WhatsApp" (abre `https://wa.me/{telefone}?text={url}` para envio manual)
  - Badge indicando "Link gerado — dispensa envio de template"

**5. `src/components/mapa/MapaVistoriasContent.tsx`** (popup do serviço no mapa)
- Ao clicar em um serviço sem profissional, mostrar duas opções:
  - "Atribuir a Técnico Interno" → fluxo atual (seletor de profissionais)
  - "Atribuir a Prestador" → abre mini-modal com lista de prestadores, campo valor, e após confirmar mostra botão "Copiar Link"

### Fluxo do usuário
1. Coordenador abre aba "Atribuição Manual" ou mapa.
2. Vê serviços pendentes à esquerda, técnicos internos E prestadores à direita.
3. Arrasta serviço para um prestador → dialog pede valor → confirma.
4. Sistema gera link via edge function (sem enviar WhatsApp) → mostra dialog com URL e botão "Copiar Link".
5. Coordenador copia e envia manualmente pelo WhatsApp ou outro canal.
6. Prestador acessa o link público e realiza a tarefa (mesma tela atual de `/prestador/instalacao/:token` ou `/vistoria-prestador/:token`).

### Sem migração de schema
As tabelas `instalacao_prestador_links`, `vistoria_prestador_links` e `vistoriadores_prestadores` já existem com todos os campos necessários. Nenhuma alteração de schema é necessária.

### Validação
1. Arrastar serviço de instalação para um prestador na aba de Atribuição Manual → dialog de confirmação com campo valor → gerar link → botão "Copiar Link" funciona.
2. Arrastar serviço de vistoria para um prestador → mesma lógica, usa `gerar-link-vistoriador-prestador`.
3. Clicar em serviço no mapa → opções "Técnico Interno" e "Prestador" visíveis.
4. Confirmar que NÃO é enviado template WhatsApp automaticamente quando `skip_whatsapp=true`.
5. Prestador acessa link copiado → página pública carrega normalmente.

