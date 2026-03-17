

## Plano: Formulário de Pontuação do Consultor na aba Regras de Venda

### Dados

A tabela `comissoes_parametros` já contém alguns parâmetros de pontuação. Preciso:

1. **Inserir parâmetros ausentes** na tabela:
   - `pontos_migracao_aprovada` (1.0)
   - `pontos_indicacao_convertida` (1.0)
   - `pontos_troca_titularidade_parcial` (0)
   - `pontos_substituicao_placa_parcial` (0)
   - `estorno_cancelamento_antes_1_boleto` (tipo toggle, valor "true")
   - `prazo_reativacao_dias` (120)

   Parâmetros já existentes que serão reutilizados:
   - `pontos_nova_adesao` (1.0)
   - `pontos_reativacao_120_dias` (1.0)
   - `pontos_troca_titularidade` (0.5)
   - `pontos_substituicao_placa` (0.5)

2. **Nenhuma migração SQL** necessária — apenas INSERT de dados via insert tool.

### Implementação no frontend

**Reescrever `src/pages/diretoria/RegrasVenda.tsx`**:

- Buscar parâmetros de `comissoes_parametros` filtrados por chaves de pontuação (reutilizar `useComissoesFaixas` ou query direta)
- Formulário com 3 blocos (Cards):
  - **Bloco 1**: 8 campos numéricos (Input type number) para peso por operação
  - **Bloco 2**: Switch (toggle) para estorno + nota explicativa
  - **Bloco 3**: Campo numérico para prazo de reativação em dias
- Estado local com `useState` inicializado a partir dos dados do banco
- Botão "Salvar configurações" que faz batch update via `updateParametro` do `useComissoesFaixas`
- Toast de confirmação após salvar

### Arquivos afetados

- `src/pages/diretoria/RegrasVenda.tsx` — reescrever conteúdo da aba "Pontuação do Consultor"
- Dados inseridos em `comissoes_parametros` (6 novas linhas)

