

## Plano: Adicionar checkboxes de Tipo de Placa no modal de Regra de Elegibilidade

### Problema
O modal "Adicionar Regra de Elegibilidade" em `EligibilityRulesEditor.tsx` não exibe nenhum campo de seleção quando o tipo "Tipo de Placa" é escolhido. Faltam os checkboxes para marcar os tipos de placa desejados.

### Correção

**Editar**: `src/components/admin/planos/EligibilityRulesEditor.tsx`

1. Importar `useConfiguracaoJson` (já importado) e carregar os tipos de placa:
   ```typescript
   const { data: tiposPlaca = [] } = useConfiguracaoJson<{ value: string; label: string; ativo?: boolean }[]>('tipos_placa', []);
   ```

2. Adicionar seção de checkboxes após o bloco de `combustivel` (linha ~404), seguindo o mesmo padrão dos outros tipos:
   ```typescript
   {ruleType === 'tipo_placa' && (
     <div className="space-y-2">
       <Label className="text-xs">Tipos de Placa</Label>
       <div className="grid grid-cols-2 gap-2">
         {tiposPlaca.filter(t => t.ativo !== false).map((t) => (
           <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
             <Checkbox
               checked={(config.values || []).includes(t.value)}
               onCheckedChange={() => toggleArrayItem('values', t.value)}
             />
             {t.label}
           </label>
         ))}
       </div>
     </div>
   )}
   ```

A chave de config usada é `values` para manter compatibilidade com o motor de cotação que já lê `rule_config.values` para regras `tipo_placa`.

### Arquivo
- **Editar**: `src/components/admin/planos/EligibilityRulesEditor.tsx` (adicionar ~15 linhas)

