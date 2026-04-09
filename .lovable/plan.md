

## Plano: Habilitar filtro de tipo_uso no nivel do plano

### Problema raiz

O plano "Select One Aplicativo" aparece para veiculos particulares porque:

1. O motor de cotacao (linha 321 de `usePlanosCotacao.ts`) **pula explicitamente** a verificacao de regras de plano: `"Planos NAO tem restricoes proprias"`
2. Nao existe NENHUMA regra de plano na tabela `entity_eligibility_rules` (zero registros com `entity_type = 'plano'`)
3. Das 9 coberturas do plano, 3 (Chuva de Granizo, Alagamento, Perda Total) aceitam `tipo_uso: ["particular"]`, entao nao sao removidas
4. Como sobram coberturas, o plano permanece visivel
5. O modal de edicao do plano (`PlanFormModal`) nao inclui `EligibilityRulesEditor`, entao nao e possivel criar regras de plano pela interface

### Alteracoes

**1. `src/hooks/usePlanosCotacao.ts` (linha ~321)**
- Remover o comentario de skip e HABILITAR `checkAllRules` para regras de plano:
```
const planoRulesNonMarcaModelo = planoRules.filter(
  r => r.rule_type !== 'marca_modelo' && r.rule_type !== 'ano_range'
);
if (planoRulesNonMarcaModelo.length > 0 && !checkAllRules(planoRulesNonMarcaModelo, vehicleCtx)) {
  negados.push({ planoId: plano.id, planoNome: plano.nome, linha: linha || '', motivo: 'Bloqueado por regra do plano' });
  continue;
}
```
- Nota: As regras de `marca_modelo` e `ano_range` do plano ja sao tratadas separadamente (linhas 280-319), entao filtramos para nao duplicar

**2. `src/components/admin/planos/PlanFormModal.tsx`**
- Adicionar `EligibilityRulesEditor` com `entityType="plano"` na aba de edicao do plano, para que o usuario possa criar regras como `tipo_uso: include ["aplicativo"]`
- Posicionar apos as secoes de coberturas e beneficios

### Resultado
- Planos com regra `tipo_uso: include ["aplicativo"]` serao filtrados automaticamente para veiculos particulares
- O usuario podera configurar regras de elegibilidade diretamente no plano (tipo_uso, regiao, combustivel, etc)
- Apos o deploy, basta adicionar a regra `tipo_uso: include ["aplicativo"]` ao plano "Select One Aplicativo" pela interface

### Arquivos
- `src/hooks/usePlanosCotacao.ts`
- `src/components/admin/planos/PlanFormModal.tsx`

