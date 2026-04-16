

## Plano: Seletor de Municípios no Editor de Técnico Interno

### Problema
O editor de técnico interno (`ProfissionalModal`) usa uma lista hardcoded de ~10 regiões genéricas (checkboxes simples como "São Paulo - Centro", "ABC Paulista"). O editor de prestador parceiro (`NovoPrestadorInstalacaoModal`) usa um seletor completo de municípios IBGE com busca, agrupamento por estado, e badges removíveis. O requisito é unificar o layout.

### Mudanças

#### 1. Extrair componente reutilizável `MunicipiosPicker`
Extrair a lógica do seletor de municípios de `NovoPrestadorInstalacaoModal` para um componente independente `src/components/monitoramento/MunicipiosPicker.tsx` que aceite:
- `value: string[]` — municípios selecionados
- `onChange: (v: string[]) => void`
- Label opcional

Conteúdo: query IBGE, agrupamento por UF, busca, badges, collapsible por estado — idêntico ao que já existe no modal de prestador.

#### 2. Atualizar `ProfissionalModal`
- Substituir o bloco de checkboxes de "Regiões de atuação" (linhas 538-571) pelo novo `MunicipiosPicker`.
- O campo do form continua sendo `regioes` (array de strings), mas agora armazena valores no formato `"Cidade - UF"` (mesmo formato do prestador).
- Atualizar o label para "Municípios de Atuação (opcional)".

#### 3. Atualizar `NovoPrestadorInstalacaoModal`
- Substituir a implementação inline pelo componente `MunicipiosPicker` extraído (sem mudança funcional).

#### 4. Salvar no campo correto
- `Equipe.tsx` linha 82: `regioes_atendimento: data.regioes` — o campo já é `string[]` no banco, então aceita tanto os slugs antigos quanto os novos valores `"Cidade - UF"`. Nenhuma mudança no banco necessária.
- O carregamento na edição (`profissional.regioes_atendimento`) já é passado como `regioes` — continuará funcionando.

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/monitoramento/MunicipiosPicker.tsx` | **Criar** — componente reutilizável |
| `src/components/monitoramento/ProfissionalModal.tsx` | Substituir checkboxes por `MunicipiosPicker` |
| `src/components/monitoramento/NovoPrestadorInstalacaoModal.tsx` | Usar `MunicipiosPicker` (refactor) |

