
### Plano para corrigir o conflito entre `vistorias` / `instalacoes` / `servicos`

### Diagnóstico
O problema não é “o drag-and-drop em si”. O conflito está no modelo de dados do mapa:

- `view_vistorias_mapa` mistura **3 fontes**: `vistorias`, `instalacoes` e `servicos`
- mas os fluxos de ação do mapa (`atribuir`, `desatribuir`, `enviar confirmação`) operam em **`public.servicos`**
- a correção anterior bloqueou tudo que não fosse `origem_registro = 'servicos'`, o que evitou erro, mas quebrou o comportamento que você precisa
- na prática, muitos itens de `vistorias`/`instalacoes` **já têm um `servico` correspondente** via `vistoria_origem_id` / `instalacao_origem_id`; o mapa é que continua usando o **ID e os campos da origem legada**, então:
  - a atribuição usa o ID errado
  - a confirmação usa o ID errado
  - a rota não aparece porque o mapa continua lendo `vistoriador_id`/`rota_id` da tabela legada, não do `servico`

### Abordagem correta
Em vez de esconder ou bloquear itens legados, vou fazer o mapa trabalhar com um **ID unificado de serviço**.

### Implementação

#### 1. Tornar a view do mapa “service-aware”
Atualizar `view_vistorias_mapa` para expor um campo como `servico_id_unificado`:

- em linhas de `servicos`: `servico_id_unificado = s.id`
- em linhas de `vistorias`: buscar o `servicos.id` ligado por `vistoria_origem_id = v.id`
- em linhas de `instalacoes`: buscar o `servicos.id` ligado por `instalacao_origem_id = i.id`

Além disso, na view, os campos usados pelo mapa devem passar a preferir o estado do `servico` vinculado:
- `vistoriador_id`
- `vistoriador_nome`
- `rota_id`, `rota_codigo`, `rota_regiao`, `rota_cor`
- `confirmacao_whatsapp`
- `periodo`
- `permite_encaixe`
- quando fizer sentido, também `status`

Assim o mapa continua mostrando uma linha por item visível, mas com o **estado operacional vindo do serviço unificado**.

#### 2. Garantir que itens legados tenham serviço correspondente
Criar uma migration de backfill para inserir `servicos` faltantes para:
- `vistorias` ativas/agendadas sem `servico` vinculado
- `instalacoes` ativas/agendadas sem `servico` vinculado

Usando as mesmas regras de mapeamento já existentes nas migrations de sincronização.

Isso elimina os “buracos” onde o item aparece no mapa mas não existe `servico` para atribuir/confirmar.

#### 3. Parar de usar `origem_registro` como bloqueio
No frontend (`MapaVistoriasContent.tsx`), `origem_registro` deve virar só informativo.

Trocar os guards atuais:
- `v.origem_registro === 'servicos'`

por uma regra única:
- `!!v.servico_id_unificado`

Aplicar isso em todos os pontos:
- botão “Atribuir” na lista
- botão “Atribuir” no popup
- busca do serviço mais próximo no `dragend`
- cancelamento de atribuição
- envio de confirmação WhatsApp

#### 4. Usar sempre o ID do serviço unificado nas actions
Quando o usuário:
- clicar para atribuir
- arrastar e soltar técnico
- cancelar rota
- enviar confirmação

o ID enviado para mutation/edge function deve ser sempre:
- `v.servico_id_unificado`

e não mais `v.id` da linha visual do mapa.

#### 5. Restaurar o botão de confirmação para os casos corretos
Hoje `podeEnviarConfirmacao` depende de:
- `atribuicaoManualAtiva`
- `origem_registro === 'servicos'`

Isso está errado para sua regra de negócio.

Vou ajustar para exibir a confirmação sempre que:
- existir `servico_id_unificado`
- não for serviço realizado
- não for encaixe
- não estiver confirmado
- estiver apto ao fluxo de confirmação

Ou seja: confirmação volta a aparecer e funcionar independentemente do modo manual.

#### 6. Fazer a rota aparecer logo após atribuir
Com a view lendo os campos efetivos do `servico`, a rota volta a aparecer no mapa assim que a atribuição salvar.

Manter/validar a invalidação de queries já usada após sucesso:
- `['vistorias-mapa']`
- `['vistoriadores-localizacao-realtime']`

Assim:
- o pin passa a mostrar o técnico atribuído
- `linhasDeRota` recalcula
- a polyline aparece imediatamente

#### 7. Endurecer as mutations para evitar falha silenciosa
Em `useAtribuicaoManual.ts` e `useDesatribuirServico.ts`:
- validar que o `servico` alvo realmente existe/foi atualizado
- só registrar log depois disso
- manter `atribuido_por` usando `profiles.id`

Isso evita voltar a cair em erro confuso por atualização “sem linha afetada”.

### Arquivos envolvidos
- `supabase/migrations/...` nova migration da view + backfill
- `src/hooks/useVistoriasMapa.ts`
- `src/components/mapa/MapaVistoriasContent.tsx`
- `src/hooks/useAtribuicaoManual.ts`
- `src/hooks/useDesatribuirServico.ts`

### Resultado esperado
Depois dessa correção:

- será possível atribuir por **drag-and-drop** e por **clique**
- isso funcionará para itens visíveis no mapa, mesmo quando vierem de `vistorias` ou `instalacoes`
- o botão de **enviar confirmação** volta a aparecer e funcionar
- a atribuição poderá ocorrer **com ou sem confirmação**
- após atribuir, a **rota do técnico até o serviço** aparecerá no mapa
- `origem_registro` deixa de quebrar o fluxo manual

### Decisão de design
Eu não seguiria criando mais bloqueios por origem nem adicionaria remendo só no popup. O conserto certo é fazer o mapa operar sobre um **identificador unificado de `servicos`**, porque é isso que o backend de atribuição e confirmação já usa.
