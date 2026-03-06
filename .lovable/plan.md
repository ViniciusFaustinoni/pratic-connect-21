

# Ressalvas no Historico + Sugestao de Ressalva por IA

## Situacao Atual

- O componente `AdicionarRessalva` ja existe e permite registro manual de ressalvas no historico (`associados_historico` com `tipo = 'ressalva_registrada'`)
- A timeline (`TimelineHistorico`) ja exibe ressalvas com icone amber e filtro dedicado
- O hook `useDecidirRessalva` ja registra no historico quando uma ressalva e aprovada/declinada (`ressalva_aprovada_monitoramento`, `ressalva_declinada_monitoramento`)
- Porem os tipos `ressalva_aprovada_monitoramento` e `ressalva_declinada_monitoramento` **nao estao mapeados** no `TipoEvento` nem no `eventoConfig` da timeline — aparecem como "Observacao adicionada" generica
- Nao existe sugestao de ressalva por IA

## Alteracoes

### 1. Novos tipos de evento na timeline (`TimelineHistorico.tsx`)

Adicionar ao `TipoEvento` e `eventoConfig`:
- `ressalva_aprovada_monitoramento` — icone CheckCircle verde, label "Ressalva aprovada"
- `ressalva_declinada_monitoramento` — icone XCircle vermelho, label "Ressalva declinada"
- `ressalva_instalacao` — icone Wrench amber, label "Ressalva de instalacao"

Adicionar ao filtro `filterCategories.ressalvas` os novos tipos.

### 2. Mapear novos tipos no hook (`useAssociadoHistoricoCompleto.ts`)

Adicionar os 3 novos tipos ao `tipoDbParaTimeline`.

### 3. Buscar ressalvas de instalacao no historico (`useAssociadoHistoricoCompleto.ts`)

Adicionar query em `servicos` onde `decisao_instalador = 'aprovado_ressalva'` e `associado_id = associadoId` para incluir na timeline com tipo `ressalva_instalacao`, mostrando o texto do instalador e link para fotos.

### 4. IA sugere ressalva apos aprovacao (`RessalvasPendentes.tsx` + nova Edge Function)

Nova Edge Function `sugerir-ressalva-ia`:
- Recebe `associado_id`, `veiculo_id`, `servico_id`, contexto do checklist NOK e ressalvas do instalador
- Consulta historico do associado, dados do veiculo, ressalvas anteriores
- Gera um texto de ressalva sugerido pela IA com analise tecnica
- Retorna: `texto_sugerido`, `pontos_atencao[]`

Na tela `RessalvasPendentes.tsx`:
- Apos o coordenador aprovar, exibir um dialog com a sugestao da IA: "A IA analisou o contexto e sugere registrar a seguinte ressalva no historico:"
- Texto editavel (textarea pre-preenchida com sugestao)
- Botoes: "Aprovar e Registrar" (salva no `associados_historico`) ou "Pular"

### 5. Componente `AdicionarRessalva` — melhorias

Sem alteracoes estruturais — ja funciona corretamente. Apenas garantir que o `queryKey` invalide tambem o historico legado.

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/components/cadastro/TimelineHistorico.tsx` | Adicionar 3 novos TipoEvento + config + filtro |
| `src/hooks/useAssociadoHistoricoCompleto.ts` | Mapear novos tipos + buscar ressalvas de instalacao |
| `supabase/functions/sugerir-ressalva-ia/index.ts` | Nova Edge Function — IA gera texto de ressalva sugerido |
| `src/pages/monitoramento/RessalvasPendentes.tsx` | Apos aprovacao, chamar IA e exibir dialog de sugestao |

4 arquivos.

