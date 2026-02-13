
# Adicionar checkbox "Termo de Saida de Evento" no formulario de Template

## Problema
O campo `is_default_saida` ja existe no banco de dados, no hook de templates e na edge function `autentique-os-saida-create`, mas o checkbox para marca-lo **nao aparece no formulario** de criacao/edicao de template. Ou seja, o backend esta pronto mas falta a UI.

## Solucao

### Arquivo: `src/pages/documentos/TemplateForm.tsx`

Adicionar um terceiro checkbox apos o de "Termo de Entrada de Evento" (linha 351), com estilo visual distinto (verde, similar ao padrao dos outros checkboxes coloridos):

- Icone: `Truck` ou `LogOut` do lucide-react (representando saida de veiculo)
- Cor: verde (`green-500`)
- Label: **Usar como padrao para Termo de Saida de Evento (OS)**
- Descricao: "Este template sera usado para gerar o Termo de Saida de Veiculo enviado ao associado quando uma Ordem de Servico for concluida. Apenas um template pode ser marcado."

O campo `is_default_saida` ja esta no schema zod (linha 39), nos defaults (linha 67), no carregamento de edicao (linha 83), e no submit de criacao (linha 137). Apenas o componente visual do checkbox esta ausente.

## Detalhe tecnico

Inserir entre a linha 351 (fim do FormField `is_default_evento`) e a linha 353 (inicio do FormField `descricao`):

```tsx
<FormField
  control={form.control}
  name="is_default_saida"
  render={({ field }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
      <FormControl>
        <Checkbox
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
      <div className="space-y-1 leading-none">
        <FormLabel className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <Truck className="h-4 w-4" />
          Usar como padrao para Termo de Saida de Evento (OS)
        </FormLabel>
        <FormDescription>
          Este template sera usado para gerar o Termo de Saida de Veiculo enviado ao associado quando
          uma Ordem de Servico for concluida. Apenas um template pode ser marcado.
        </FormDescription>
      </div>
    </FormItem>
  )}
/>
```

Tambem adicionar `Truck` ao import do `lucide-react` no topo do arquivo.

## Resumo
- **1 arquivo alterado**: `src/pages/documentos/TemplateForm.tsx`
- Adicionar import `Truck` do lucide-react
- Adicionar checkbox para `is_default_saida` entre os checkboxes existentes e o campo descricao
