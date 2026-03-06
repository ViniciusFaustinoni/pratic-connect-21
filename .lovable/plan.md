

# Ressalvas no Fluxo de Eventos + Dossiê Completo do Associado via IA

## Problema Atual

1. A Edge Function `analise-risco-ia` **não consulta ressalvas** (`associados_historico` com tipo `ressalva_registrada`) nem o histórico completo do associado
2. A tela `EventoAnaliseDetalhe.tsx` **não exibe ressalvas** nem histórico do associado
3. O analista toma decisões sem visibilidade sobre pendências técnicas ou padrões de comportamento registrados

## Solução

Duas frentes: (A) alimentar a IA com ressalvas e histórico completo, e (B) exibir essas informações na tela de análise.

### A. Edge Function `analise-risco-ia` — Incluir ressalvas e histórico

Adicionar ao fluxo de coleta de dados:

1. **Ressalvas do veículo/associado** — query em `associados_historico` filtrando `tipo = 'ressalva_registrada'`
2. **Histórico completo do associado** — query em `associados_historico` (todos os tipos) para dar contexto de alterações de status, documentos reprovados, observações
3. **Ressalvas de instalação** — query em `servicos` onde `decisao_instalador = 'aprovado_ressalva'` para o veículo do sinistro (pega `ressalvas_instalador` e `fotos_ressalva`)

Incluir esses dados no prompt da IA como novas seções:
- `RESSALVAS REGISTRADAS` (lista com data, descrição, veículo)
- `HISTÓRICO DO ASSOCIADO` (resumo dos eventos: quantas alterações de status, documentos reprovados, etc.)
- Nova regra de avaliação: "Ressalvas registradas sobre o veículo ou associado são sinais de atenção e devem ser consideradas na pontuação"

### B. Nova seção na tela `EventoAnaliseDetalhe.tsx` — "Dossiê do Associado"

Novo AccordionItem entre "Dados do Associado" e "Cronologia" com:

1. **Ressalvas registradas** — lista com badge amber, data, descrição, veículo (se aplicável), quem registrou
2. **Ressalvas de instalação** — se o veículo do sinistro teve `aprovado_ressalva` no serviço de instalação, exibir o texto e fotos
3. **Histórico resumido** — timeline compacta dos últimos 10 eventos do associado (reutilizando dados de `associados_historico`)

### C. Hook `useEventoAnaliseDetalhe.ts` — Buscar ressalvas

Adicionar duas queries:
1. Ressalvas do histórico (`associados_historico` onde `tipo = 'ressalva_registrada'`)
2. Ressalvas de instalação do veículo (`servicos` onde `decisao_instalador = 'aprovado_ressalva'` e `veiculo_id = veiculoId`)

## Arquivos

| Arquivo | Acao |
|---|---|
| `supabase/functions/analise-risco-ia/index.ts` | Adicionar queries de ressalvas e histórico no prompt da IA |
| `src/hooks/useEventoAnaliseDetalhe.ts` | Adicionar queries para ressalvas e histórico do associado |
| `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx` | Nova seção "Dossiê do Associado" com ressalvas e histórico |

3 arquivos.

