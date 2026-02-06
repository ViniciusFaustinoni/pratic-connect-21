

## Plano: Adicionar Exibição de Dados do CRLV no Card de Documentos

### Diagnóstico

| Item | Status | Detalhes |
|------|--------|----------|
| OCR extrai cor do CRLV | ✅ Implementado | Campo `dados.cor` |
| OCR extrai combustível | ✅ Implementado | Campo `dados.combustivel` |
| OCR extrai motor | ✅ Implementado | Campo `dados.motor` |
| Exibição no card | ❌ Faltando | Apenas CNH tem exibição de dados extraídos |

### Alterações Necessárias

#### 1. Expandir interface de tipos para incluir dados do CRLV

Modificar a interface `CnhDadosOCR` para suportar também os campos do CRLV:

```typescript
interface DocumentoDadosOCR {
  // Campos da CNH
  nome?: string;
  numero_registro?: string;
  rg?: string;
  validade?: string;
  // Campos do CRLV
  cor?: string;
  combustivel?: string;
  motor?: string;
  placa?: string;
  renavam?: string;
  chassi?: string;
}
```

#### 2. Adicionar exibição de dados do CRLV no card de listagem

Após o bloco que exibe dados da CNH (linha 177), adicionar:

```typescript
{/* Dados extraídos do CRLV */}
{doc.tipo === 'crlv' && doc.ocr_resultado?.dados && (
  <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
    {doc.ocr_resultado.dados.cor && (
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold">Cor:</span> {doc.ocr_resultado.dados.cor}
      </p>
    )}
    {doc.ocr_resultado.dados.combustivel && (
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold">Combustível:</span> {doc.ocr_resultado.dados.combustivel}
      </p>
    )}
    {doc.ocr_resultado.dados.motor && (
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold">Motor:</span> {doc.ocr_resultado.dados.motor}
      </p>
    )}
  </div>
)}
```

#### 3. Adicionar exibição de dados do CRLV no Dialog

Após o bloco que exibe dados da CNH no Dialog (linha 244), adicionar:

```typescript
{/* Dados extraídos do CRLV no Dialog */}
{selectedDoc.tipo === 'crlv' && selectedDoc.ocr_resultado?.dados && (
  <div className="w-full bg-info/10 border border-info/30 rounded-lg p-4 mb-4 space-y-2">
    <p className="text-sm font-semibold text-info">Dados Extraídos:</p>
    {selectedDoc.ocr_resultado.dados.placa && (
      <div className="flex justify-between">
        <span className="text-xs font-medium text-muted-foreground">Placa:</span>
        <span className="text-xs text-foreground">{selectedDoc.ocr_resultado.dados.placa}</span>
      </div>
    )}
    {selectedDoc.ocr_resultado.dados.renavam && (
      <div className="flex justify-between">
        <span className="text-xs font-medium text-muted-foreground">Renavam:</span>
        <span className="text-xs text-foreground">{selectedDoc.ocr_resultado.dados.renavam}</span>
      </div>
    )}
    {selectedDoc.ocr_resultado.dados.chassi && (
      <div className="flex justify-between">
        <span className="text-xs font-medium text-muted-foreground">Chassi:</span>
        <span className="text-xs text-foreground">{selectedDoc.ocr_resultado.dados.chassi}</span>
      </div>
    )}
    {selectedDoc.ocr_resultado.dados.cor && (
      <div className="flex justify-between">
        <span className="text-xs font-medium text-muted-foreground">Cor:</span>
        <span className="text-xs text-foreground">{selectedDoc.ocr_resultado.dados.cor}</span>
      </div>
    )}
    {selectedDoc.ocr_resultado.dados.combustivel && (
      <div className="flex justify-between">
        <span className="text-xs font-medium text-muted-foreground">Combustível:</span>
        <span className="text-xs text-foreground">{selectedDoc.ocr_resultado.dados.combustivel}</span>
      </div>
    )}
    {selectedDoc.ocr_resultado.dados.motor && (
      <div className="flex justify-between">
        <span className="text-xs font-medium text-muted-foreground">Motor:</span>
        <span className="text-xs text-foreground">{selectedDoc.ocr_resultado.dados.motor}</span>
      </div>
    )}
  </div>
)}
```

---

### Resultado Visual Esperado

**Card de Listagem - CRLV:**
```
┌─────────────────────────────────────┐
│ 🚗 CRLV                             │
│ 15/02/2025 às 10:30                 │
│ ─────────────────────────────────   │
│ Cor: PRATA                          │
│ Combustível: FLEX                   │
│ Motor: M155966                      │
│ [Validado por IA] [👁️ Visualizar]  │
└─────────────────────────────────────┘
```

**Dialog ao clicar no CRLV:**
```
┌────────────────────────────────────────┐
│ CRLV                              ✕   │
├────────────────────────────────────────┤
│ 📋 Dados Extraídos:                   │
│ Placa: ABC1D23                        │
│ Renavam: 12345678901                  │
│ Chassi: 9BWZZZ377VT123456            │
│ Cor: PRATA                            │
│ Combustível: FLEX                     │
│ Motor: M155966                        │
│                                        │
│ [Imagem do CRLV]                      │
└────────────────────────────────────────┘
```

---

### Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/cadastro/DocumentosAnexadosCard.tsx` | Expandir interface e adicionar exibição de dados do CRLV |

---

### Sequência de Implementação

1. Renomear interface `CnhDadosOCR` para `DocumentoDadosOCR` e adicionar campos do CRLV
2. Adicionar bloco de exibição de dados do CRLV no card de listagem
3. Adicionar bloco de exibição de dados do CRLV no Dialog de visualização
4. Testar com CRLVs reais no sistema

