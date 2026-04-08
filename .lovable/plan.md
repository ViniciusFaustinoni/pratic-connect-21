

## Plano: Regra Geral Unificada de Filtros — Cotação, Calculadora e Termos

### Estado: ✅ IMPLEMENTADO

Todos os 3 motores (Cotação, Calculadora, Termos) agora seguem a mesma regra unificada:

| Motor | Estado |
|-------|--------|
| **Cotador** (`usePlanosCotacao.ts`) | ✅ Hierarquia Linha→Plano(sem regra)→Itens(filtra) |
| **Calculadora** (`CalculadoraPreco.tsx`) | ✅ Usa `usePlanosCotacao` |
| **Termos** (`contrato-gerar/index.ts`) | ✅ Carências do catálogo, detecção via `marcas_modelos` |
| **Autentique** (`autentique-create/*.ts`) | ✅ Filtra itens inelegíveis via `entity_eligibility_rules` |
| **SGA Hinova Sync** | ✅ Usa `marcas_modelos` em vez de tabela legada |

### Tabelas/Lógicas Inutilizadas
- `plano_elegibilidade_modelos` — não é mais consultada por nenhum motor ativo
- `tabelas_preco_mensalidade` + `plano_preco_map` — apenas usadas em `useCotacaoAvancada` (marcado @deprecated)
- `parse-elegibilidade-pdf/xlsx` — marcadas como DEPRECATED
- Filtros legados no plano (`tipo_uso`, `fipe_minima`, etc.) — ignorados

### Fluxo Unificado

```text
1. Linha (entity_eligibility_rules, entity_type='linha')
   ├── tipo de veículo
   ├── ano de fabricação
   └── marca/modelo
       → Falhou? Descarta toda a linha

2. Plano → SEM restrições

3. Coberturas/Benefícios (entity_type='cobertura'/'beneficio')
   ├── FIPE (min/max)
   ├── Região
   ├── Tipo de Placa
   ├── Combustível
   └── Tipo de Uso
       → Falhou? Remove item, mantém plano
       → Preço = soma dos elegíveis

4. Carências
   ├── Geral: max(carencia_dias de cada cobertura ativa no catálogo)
   ├── Vidros: config separada
   └── Migração: isenção se aprovada
```
