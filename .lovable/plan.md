

# Registrar Ressalvas no Historico de Associados/Veiculos

## Resumo

Adicionar um botao "Registrar Ressalva" na aba Historico do `AssociadoDetalhe.tsx`, similar ao componente `AdicionarObservacao` ja existente, mas especifico para ressalvas. O coordenador de monitoramento podera documentar inconsistencias com tipo `ressalva_registrada`, campo de texto obrigatorio e opcao de selecionar o veiculo relacionado.

## Alteracoes

### 1. Novo componente `src/components/cadastro/AdicionarRessalva.tsx`

Componente com:
- Botao "Registrar Ressalva" (icone AlertTriangle, cor amber)
- Ao expandir: campo de texto (descricao da ressalva), select opcional para escolher o veiculo do associado (busca veiculos do associado), e botoes Cancelar/Salvar
- Insere na tabela `associados_historico` com `tipo: 'ressalva_registrada'` e `dados_novos` contendo veiculo_id/placa se selecionado
- Usa `supabase.auth.getUser()` para registrar o usuario

### 2. `src/hooks/useAssociadoHistoricoCompleto.ts` — Mapear novo tipo

Adicionar `'ressalva_registrada': 'observacao_adicionada'` no mapeamento `tipoDbParaTimeline` (reutiliza o icone de observacao, ou podemos criar um tipo especifico).

### 3. `src/pages/cadastro/AssociadoDetalhe.tsx` — Renderizar componente

Na aba `historico` (linha 813), adicionar o componente `AdicionarRessalva` logo acima da timeline, ao lado do titulo. Visivel apenas para coordenadores de monitoramento (verificar permissao).

### 4. `src/components/associados/detalhe/AssociadoResumoTab.tsx` — Mapear titulo

Adicionar `'ressalva_registrada': 'Ressalva registrada'` no mapa de titulos e configurar icone/cor amber.

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/components/cadastro/AdicionarRessalva.tsx` | Novo — formulario de ressalva com select de veiculo |
| `src/hooks/useAssociadoHistoricoCompleto.ts` | Adicionar tipo no mapeamento |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Renderizar AdicionarRessalva na aba historico + import |
| `src/components/associados/detalhe/AssociadoResumoTab.tsx` | Mapear titulo/icone/cor do novo tipo |

4 arquivos.

