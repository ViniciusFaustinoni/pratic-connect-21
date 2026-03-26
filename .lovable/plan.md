

# Revisao do Sistema de Regras de Elegibilidade — Correcoes Necessarias

## Problemas Encontrados

### 1. Chave errada para Categorias Especiais no EligibilityRulesEditor
O `EligibilityRulesEditor` busca categorias especiais com a chave `categorias_especiais`, mas o CRUD do diretor (`CategoriasEspeciaisTab.tsx`) salva na chave `categorias_veiculo`. Resultado: o editor mostra lista vazia de categorias especiais.

**Correcao**: Trocar `useConfiguracaoJson('categorias_especiais', [])` por `useCategoriasVeiculo()` no `EligibilityRulesEditor.tsx`.

### 2. Motor de cotacao com log