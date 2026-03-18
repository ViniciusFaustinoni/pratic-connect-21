

## Plano: Tornar percentuais de depreciação configuráveis e adicionar editor visual

### Contexto

A chave `regras_depreciacao` já existe na tabela `configuracoes` (categoria `operacional`, tipo `json`) com os valores corretos. O modal `IniciarIndenizacaoModal.tsx` usa uma constante hardcoded `DEPRECIACOES` (linhas 23-31). O painel administrativo em `/diretoria/configuracoes` já renderiza configs por categoria com editores visuais especializados por chave.

### Alterações

**1. `src/components/sinistros/IniciarIndenizacaoModal.tsx`**
- Remover a constante `DEPRECIACOES` hardcoded (linhas 23-31)
- Adicionar hook `useConfiguracaoJson` para buscar `regras_depreciacao` do banco, com fallback para os mesmos valores atuais
- Adaptar o código que itera sobre `DEPRECIACOES` para usar os dados do banco (mesma estrutura: `flag`, `label`, `percentual`, `adicional`)
- A lógica de cálculo (maior percentual entre concorrentes + avarias compostas) permanece inalterada, apenas a fonte dos dados muda

**2. `src/components/configuracoes/json-editors/DepreciacaoEditor.tsx`** (novo)
- Componente visual para editar as regras de depreciação
- Exibe tabela com colunas: Flag, Categoria, Percentual (%), Tipo (Concorrente/Adicional)
- Permite editar o percentual de cada categoria inline
- Toggle para marcar se é "adicional" (como avarias) ou "concorrente" (usa o maior)
- Não permite adicionar/remover itens (as flags são fixas no banco de veículos), apenas editar valores

**3. `src/pages/diretoria/Configuracoes.tsx`**
- Adicionar case `regras_depreciacao` no `renderJsonEditor` (linha 178-262) que renderiza o novo `DepreciacaoEditor`
- Adicionar hint em `FALLBACK_HINTS` para a chave explicando o comportamento

### Estrutura de dados (já existente no banco)

```json
[
  {"flag": "flag_placa_vermelha", "label": "Placa vermelha", "percentual": 25, "adicional": false},
  {"flag": "flag_avarias_vistoria", "label": "Avarias pré-existentes", "percentual": 20, "adicional": true}
]
```

- `adicional: false` = concorrente (aplica-se o maior entre todos os concorrentes)
- `adicional: true` = composto (aplica-se sobre o valor já depreciado)

### Nenhuma migração necessária
A chave já existe no banco com os dados corretos.

