Confirmei no código: o sistema tem parte da regra, mas ainda não está 100% conforme os 3 pontos.

Situação atual:

1. Coordenador de monitoramento pode realocar?
   - Parcialmente sim. No Mapa de Atribuições, `isCoordenadorMonitoramento` já libera ações como reagendar/alterar endereço/tipo.
   - Porém a realocação completa rota/base está desigual: o botão/modal de “Realocar” aparece principalmente para `instalacao`, não para todos os tipos de vistoria/serviço.

2. Rota → Base com seleção da base e aplicação imediata?
   - Existe fluxo em `AlterarEnderecoTipoDialog` e `useAlterarEnderecoTipo` que converte rota para base, cria `agendamentos_base`, cancela o serviço de rota e exige selecionar base/horário.
   - Também existe `RealocarInstalacaoDialog` para instalação, mas focado em instalação e com lógica separada.
   - Risco atual: o acesso ao fluxo não está exposto de forma consistente para todos os tipos de vistoria no mapa/calendário.

3. Base → Rota pedindo endereço, coordenadas e exibindo no mapa?
   - A lógica backend/frontend existe em `useAlterarEnderecoTipo`: ao converter base para rota, pede endereço, chama `geocode-endereco`, grava latitude/longitude em `servicos` e cria serviço de rota.
   - Mas encontrei uma lacuna importante: `AlterarEnderecoTipoDialog` hoje só é chamado no mapa com `origem="rota"`. Não há botão equivalente na aba Base do calendário/modal para abrir o diálogo com `origem="base"` e `agendamentoBaseId`.
   - Além disso, a view do mapa (`view_vistorias_mapa`) mostra serviços convertidos quando têm coordenadas, mas se a geocodificação falhar, a tarefa pode ficar sem aparecer no mapa até corrigir o endereço.

Plano de ajuste para ficar 100% conforme a regra:

1. Unificar a ação “Alterar tipo rota/base” para vistorias e instalações
   - Expor a ação para todos os serviços elegíveis, não apenas instalação.
   - Usar o fluxo existente de `AlterarEnderecoTipoDialog` como padrão para mudança de tipo.

2. Corrigir Rota → Base
   - Ao selecionar “Base”, exigir base e horário/período.
   - Salvar imediatamente criando/atualizando o registro em `agendamentos_base` e retirando a tarefa da rota/mapa.
   - Invalidar as queries corretas para refletir imediatamente no Mapa e no Calendário da Base.

3. Implementar acesso Base → Rota na UI
   - Na aba Base do `CalendarioDiaModal`, adicionar botão “Alterar para Rota” ou “Alterar endereço/tipo”.
   - Abrir `AlterarEnderecoTipoDialog` com `origem="base"` e `agendamentoBaseId`.
   - Pedir endereço completo antes de salvar.

4. Garantir coordenadas e aparição no mapa
   - Manter chamada à Edge Function `geocode-endereco` ao salvar Base → Rota.
   - Se obtiver latitude/longitude, a nova tarefa entra no `view_vistorias_mapa` e aparece no mapa.
   - Se não obtiver coordenadas, mostrar aviso claro e deixar a tarefa na lista “sem GPS” com atalho para corrigir endereço, em vez de parecer que sumiu.

5. Permissões
   - Garantir que `coordenador_monitoramento` tenha acesso à ação, junto com Diretor/Admin/Desenvolvedor e, se mantido, Analista de Monitoramento.
   - Não depender de localStorage ou regra client-side sensível; apenas usar as permissões já vindas do sistema de roles.

Arquivos que serão ajustados:
- `src/components/mapa/MapaVistoriasContent.tsx`
- `src/components/mapa/AlterarEnderecoTipoDialog.tsx`
- `src/hooks/useAlterarEnderecoTipo.ts`
- `src/components/monitoramento/CalendarioDiaModal.tsx`

Se aprovado, implemento esses ajustes e valido com build.