

# Importação de Elegibilidade: aceitar Excel + botão baixar modelo

## O que muda

1. **Dropzone aceita PDF e Excel** (.xlsx, .xls)
2. **Excel processado client-side** com `xlsx` (já instalado) — sem edge function
3. **Botão "Baixar modelo Excel"** gera um .xlsx de exemplo com cabeçalhos e dados fictícios
4. **Labels atualizados** para refletir ambos os formatos

## Implementação — arquivo único

**`src/components/gestao-comercial/ElegibilidadeVeiculos.tsx`**

### Dropzone (linha ~398)
```typescript
accept: {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
}
```

### Função `processar` (linha ~405)
Detectar extensão do arquivo:
- **PDF** → fluxo atual (edge function)
- **Excel** → parsing client-side:
  1. `XLSX.read(arrayBuffer)` → primeira sheet → `sheet_to_json`
  2. Validar colunas: MARCA, MODELO, ANO_MIN, ANO_MAX, COMBUSTIVEL, STATUS, OBSERVACAO
  3. Validar cada linha (status válidos, combustíveis válidos, ano numérico)
  4. Se modo "substituir" → desativar registros anteriores via supabase
  5. `supabase.from('plano_elegibilidade_modelos').insert(registros)`
  6. Exibir resultado igual ao fluxo PDF

### Botão "Baixar modelo" (após título, linha ~562)
Gera Excel client-side com `xlsx`:
- Cabeçalho: MARCA | MODELO | ANO_MIN | ANO_MAX | COMBUSTIVEL | STATUS | OBSERVACAO
- 5 linhas de exemplo preenchidas
- Download automático como `modelo_elegibilidade.xlsx`

### Labels
- "Importar PDF" → "Importar Arquivo"
- "Arraste o PDF" → "Arraste o arquivo (PDF ou Excel)"
- "Processar PDF" → "Processar Arquivo"
- Tab "importar-pdf" label → "Importar Arquivo"

