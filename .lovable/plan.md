

## Plano: Exibir Dados da CNH no Card de Documentos Anexados

### Contexto Atual

O componente `DocumentosAnexadosCard.tsx` atualmente exibe:
- ✅ Nome do documento e tipo (ex: "CNH")
- ✅ Data de upload
- ✅ Badge "Validado por IA" quando OCR foi bem-sucedido
- ❌ Dados extraídos do documento (validade, número de registro, RG)

O OCR já extrai corretamente os dados da CNH:
- `dados.validade` (formato YYYY-MM-DD)
- `dados.numero_registro` (11 dígitos - número de registro da CNH)
- `dados.rg` (número do RG)

### Estrutura de Dados

Conforme documentação do `document-ocr`, a resposta inclui:

```typescript
{
  sucesso: boolean,
  dados: {
    validade: "YYYY-MM-DD",
    numero_registro: "12345678901",
    rg: "12345678-9",
    // ... outros campos
  },
  validado_ocr: boolean,
  confianca: number
}
```

### Solução Proposta

#### 1. Adicionar função auxiliar para extrair e formatar dados específicos de CNH

Na linha após `getDocConfig`, adicionar:

```typescript
const getCnhData = (ocr_resultado: any) => {
  if (!ocr_resultado?.dados) return null;
  
  const { validade, numero_registro, rg } = ocr_resultado.dados;
  
  return {
    validade: validade ? format(new Date(validade), 'dd/MM/yyyy', { locale: ptBR }) : null,
    numeroRegistro: numero_registro,
    rg: rg,
  };
};
```

#### 2. Exibir dados da CNH no card de listagem

Modificar o card de cada documento (após a linha 148, dentro do `<div>` que contém label e data) para mostrar dados específicos quando for CNH:

```typescript
<div>
  <p className={cn(
    "font-medium text-sm",
    isHighlight 
      ? "text-foreground" 
      : "text-foreground"
  )}>
    {docConfig.label}
  </p>
  <p className="text-xs text-muted-foreground">
    {format(new Date(doc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
  </p>
  
  {/* NOVO: Exibir dados de CNH */}
  {doc.tipo === 'cnh' && doc.ocr_resultado?.dados && (
    <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
      {doc.ocr_resultado.dados.numero_registro && (
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">Nº Registro:</span> {doc.ocr_resultado.dados.numero_registro}
        </p>
      )}
      {doc.ocr_resultado.dados.rg && (
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">RG:</span> {doc.ocr_resultado.dados.rg}
        </p>
      )}
      {doc.ocr_resultado.dados.validade && (
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">Válidade:</span>{' '}
          {format(new Date(doc.ocr_resultado.dados.validade), 'dd/MM/yyyy', { locale: ptBR })}
        </p>
      )}
    </div>
  )}
</div>
```

#### 3. Exibir dados completos no Dialog

Também melhorar o Dialog para mostrar todos os dados extraídos quando a CNH é clicada (após o título do Dialog, antes da imagem):

```typescript
{selectedDoc && selectedDoc.tipo === 'cnh' && selectedDoc.ocr_resultado?.dados && (
  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4 space-y-2">
    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Dados Extraídos:</p>
    {selectedDoc.ocr_resultado.dados.nome && (
      <div className="flex justify-between">
        <span className="text-xs font-medium">Nome:</span>
        <span className="text-xs">{selectedDoc.ocr_resultado.dados.nome}</span>
      </div>
    )}
    {selectedDoc.ocr_resultado.dados.numero_registro && (
      <div className="flex justify-between">
        <span className="text-xs font-medium">Nº Registro:</span>
        <span className="text-xs">{selectedDoc.ocr_resultado.dados.numero_registro}</span>
      </div>
    )}
    {selectedDoc.ocr_resultado.dados.rg && (
      <div className="flex justify-between">
        <span className="text-xs font-medium">RG:</span>
        <span className="text-xs">{selectedDoc.ocr_resultado.dados.rg}</span>
      </div>
    )}
    {selectedDoc.ocr_resultado.dados.validade && (
      <div className="flex justify-between">
        <span className="text-xs font-medium">Válidade:</span>
        <span className="text-xs">
          {format(new Date(selectedDoc.ocr_resultado.dados.validade), 'dd/MM/yyyy', { locale: ptBR })}
        </span>
      </div>
    )}
  </div>
)}
```

### Arquivos a Modificar

| Arquivo | Mudança | Linhas |
|---------|---------|--------|
| `src/components/cadastro/DocumentosAnexadosCard.tsx` | Adicionar exibição de dados da CNH na listagem e no Dialog | 136-149 e 175-200 |

### Resultado Visual Esperado

**Antes:**
```
┌─────────────────────────────────────┐
│ 📋 CNH                              │
│ 15/02/2025 às 10:30                 │
│ [Validado por IA] [👁️ Visualizar]  │
└─────────────────────────────────────┘
```

**Depois:**
```
┌─────────────────────────────────────┐
│ 📋 CNH                              │
│ 15/02/2025 às 10:30                 │
│ ─────────────────────────────────   │
│ Nº Registro: 12345678901            │
│ RG: 12345678-9                      │
│ Válidade: 20/10/2028                │
│ [Validado por IA] [👁️ Visualizar]  │
└─────────────────────────────────────┘
```

**Dialog ao clicar:**
```
┌────────────────────────────────────────┐
│ CNH                               ✕   │
├────────────────────────────────────────┤
│ 📋 Dados Extraídos:                   │
│ Nome: João Silva Santos               │
│ Nº Registro: 12345678901              │
│ RG: 12345678-9                        │
│ Válidade: 20/10/2028                  │
│                                        │
│ [Imagem da CNH]                       │
│                                        │
└────────────────────────────────────────┘
```

### Sequência de Implementação

1. Adicionar exibição de dados CNH no card de listagem
2. Adicionar exibição de dados CNH no Dialog de visualização
3. Garantir formatação correta de datas
4. Testar com CNHs reais no sistema

### Benefícios

- ✅ Dados da CNH visíveis sem abrir o documento
- ✅ Validação de validade da CNH aparente imediatamente
- ✅ Número de registro e RG acessíveis para verificação rápida
- ✅ Melhor experiência do analista na revisão de documentos

