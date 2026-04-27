
## Verificação de Sinal do Rastreador antes da Aprovação

### Objetivo
Após o técnico vincular o IMEI do rastreador instalado, ele deve **ver no mapa o pino com a posição atual do veículo** e confirmar visualmente que o equipamento está comunicando antes que o botão "Aprovar" seja liberado.

### Comportamento esperado

1. Técnico digita o IMEI e clica em buscar (fluxo já existe).
2. Após o rastreador ser localizado, aparece um novo bloco **"Verificar Sinal do Rastreador"** com:
   - Botão **"Buscar posição agora"** (aciona busca on-demand via edge function `rastreador-posicao`).
   - Estado de loading enquanto consulta o provedor.
   - Quando retornar posição válida (lat/lng + `data_posicao` recente):
     - Renderiza o mapa (Leaflet) com o pino do veículo, endereço aproximado, horário da última comunicação e status de ignição.
     - Exibe checkbox obrigatório: **"Confirmo que o pino corresponde à localização do veículo"**.
   - Se a edge function retornar `tempo_real: false` ou sem posição: mostrar alerta amarelo orientando o técnico a aguardar e tentar novamente (com botão "Tentar de novo"). O técnico não consegue avançar sem uma posição confirmada.
3. O botão **Aprovar** só fica habilitado quando: dados conferidos + fotos + vídeo + IMEI vinculado + **posição confirmada visualmente pelo técnico**.
4. Mensagem de aviso no rodapé inclui: "📍 Confirme a posição do rastreador no mapa." quando faltar essa etapa.

### Aplicabilidade
- A nova etapa só aparece quando `veiculoPrecisaRastreador === true` E o IMEI foi recém vinculado nesta vistoria (`rastreadorEncontrado` preenchido).
- Se `veiculoJaTemRastreador` (vínculo prévio), a etapa também aparece para validar o sinal — mas com botão direto de "Buscar posição" usando o `rastreador_id` já existente (garante que o equipamento continua online).

### Detalhes técnicos

**Arquivo principal**
- `src/pages/instalador/ExecutarVistoriaCompleta.tsx`
  - Novos estados: `posicaoConfirmada: boolean`, `posicaoBuscada: PosicaoTempoRealResponse | null`.
  - Resolver `rastreadorIdAtivo` = `rastreadorEncontrado?.id ?? (vistoria as any)?.instalacao?.rastreador_id ?? (veiculo as any)?.rastreador_id`.
  - Inserir novo Card "Verificar Sinal do Rastreador" logo após o Card de Vincular Rastreador (linha ~820), só renderizado quando `veiculoPrecisaRastreador && rastreadorIdAtivo`.
  - Atualizar `podeAprovar` para incluir `posicaoConfirmada`.
  - Atualizar a mensagem do rodapé (linha ~890) com o aviso de posição.
  - Resetar `posicaoConfirmada` quando técnico clica em "Alterar IMEI".

**Componente novo**
- `src/components/instalador/VerificarSinalRastreador.tsx`
  - Props: `rastreadorId: string`, `onConfirmar: (confirmado: boolean) => void`, `confirmado: boolean`.
  - Usa `useRastreadorTempoReal(rastreadorId, false)` (sem auto-refresh) + `atualizarManual` para a busca on-demand.
  - Reutiliza `MapaRastreador` (`src/components/rastreadores/MapaRastreador.tsx`) com `mostrarControles={false}` e altura compacta (~280px) para mobile.
  - Mostra: status de comunicação, idade da última posição (`formatDistanceToNow`), velocidade, ignição.
  - Checkbox de confirmação só fica habilitado quando há `posicao` válida e `tempo_real === true` (ou posição com menos de X minutos — definir 10 min).

**Backend**
- Nenhuma alteração. A edge function `rastreador-posicao` já existe e segue o padrão on-demand (alinhado a `mem://architecture/tracking/on-demand-positioning-strategy`).

### Não muda
- Fluxo de vínculo de IMEI permanece igual.
- Aprovação no servidor (`useAprovarVeiculoVistoria`) não muda — a confirmação visual é uma trava de UI no técnico.
- Não há novo registro no banco; opcionalmente podemos anexar `posicao_confirmada_em` nas observações da vistoria (não incluído neste plano para manter escopo enxuto — confirme se quiser persistir).

### Arquivos
- Editar: `src/pages/instalador/ExecutarVistoriaCompleta.tsx`
- Criar: `src/components/instalador/VerificarSinalRastreador.tsx`
