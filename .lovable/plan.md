Plano de implementação

1. Ajustar somente a fonte de técnicos da Atribuição Manual
- Atualizar `useVistoriadoresAtivos` para montar a lista considerando o perfil operacional efetivo do técnico.
- Para técnicos operando como `vistoriador_base`: incluir na lista mesmo sem localização recente, sem app online e sem `em_servico`.
- Para técnicos operando como `instalador_vistoriador`: manter a regra atual, aparecendo apenas quando estiver online/ativo no app.
- Respeitar a alternância já implementada em `tecnico_perfil_operacional`: cobertura temporária terá prioridade sobre o perfil fixo de `user_roles`.

2. Preservar o escopo solicitado
- Não alterar distribuição automática, dashboards, relatórios, escalas, app do técnico ou regras globais.
- Manter o comportamento do mapa de rota para técnicos de campo: marcadores continuam dependendo de GPS/localização recente.
- Aplicar o ajuste apenas na aba `Monitoramento > Mapa > Atribuições` e no popover/lista de Atribuição Manual.

3. Adicionar indicação visual na lista de técnicos
- No popover “Atribuir a um técnico”, mostrar ao lado do nome:
  - Perfil atual: `Rota` ou `Base`.
  - Presença/fonte de disponibilidade:
    - Rota: `Online` em verde.
    - Base: `Na base` em azul/neutro.
    - Se base também estiver com app ativo, mostrar `Na base • App ativo`.
- Ordenar a lista preferencialmente com técnicos de rota online primeiro e vistoriadores base depois, sem quebrar busca/filtro do componente.

4. Ajustar a confirmação e atribuição por clique
- Garantir que a atribuição por clique use a nova lista de técnicos disponíveis.
- Manter as validações existentes ao salvar a atribuição.
- Para serviços de rota, manter bloqueio existente que impede técnico alocado como base de receber rota, caso esta regra já esteja ativa no fluxo atual.

5. Alinhar o mapa de atribuições sem ampliar impacto
- O mapa continuará mostrando marcadores apenas para técnicos com GPS/online, porque vistoriador base offline não possui coordenada para marcador.
- A disponibilidade do vistoriador base offline aparecerá na lista manual de atribuição, que é o ponto necessário para destravar a operação.
- Se houver legenda/contador de profissionais na própria aba, ajustar texto apenas quando necessário para não sugerir que “disponíveis” significa exclusivamente “online no app”.

6. Validação
- Executar build/typecheck para confirmar que não há erros TypeScript.
- Conferir que:
  - técnico de rota offline não aparece na lista;
  - técnico de rota online aparece como `Rota / Online`;
  - vistoriador base offline aparece como `Base / Na base`;
  - técnico alternado para base passa a aparecer sempre;
  - técnico alternado para rota volta a depender do app online.

Detalhes técnicos

- A consulta de `useVistoriadoresAtivos` será expandida para buscar:
  - perfis permanentes em `user_roles`;
  - perfis operacionais ativos em `tecnico_perfil_operacional`;
  - dados do `profiles`;
  - localização recente em `vistoriadores_localizacao`;
  - turno aberto em `turnos_profissionais`.
- O retorno do hook ganhará campos auxiliares, por exemplo:
  - `role_operacional`
  - `perfilAtualLabel`
  - `fonteDisponibilidade`
  - `appAtivo`
  - `disponibilidadeTipo`
- Nenhuma migration de banco é necessária, pois as tabelas e a função de alternância de perfil operacional já existem.