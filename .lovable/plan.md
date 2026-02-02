
# Plano: Extrair Cor do Veículo do CRLV na Cotação Pública

## Problema Identificado

Quando o cliente envia o CRLV na jornada da cotação pública, o documento é apenas salvo no storage **sem extrair os dados via OCR**. A cor do veículo (e outros dados como chassi, renavam) não são capturados automaticamente.

### Fluxo Atual (incompleto)
```
Cliente faz upload do CRLV
    │
    ├─► Upload para Storage ✓
    ├─► Salva URL no banco ✓
    └─► Extração de dados via OCR ✗ (NÃO FEITO)
```

### Fluxo de Outros Módulos (correto)
No `UnifiedDocumentUploader.tsx` (usado em contratos internos):
```
Upload documento
    │
    ├─► Upload para Storage
    ├─► Chama document-ocr
    ├─► Extrai tipo, cor, placa, chassi, renavam...
    └─► Salva dados extraídos no banco
```

---

## Solução Proposta

Modificar o `handleUploadDocumento` na `CotacaoPublicaCompleta.tsx` para:

1. **Após upload do CRLV**, chamar o Edge Function `document-ocr`
2. **Extrair os dados** (cor, chassi, renavam, placa, etc.)
3. **Atualizar a cotação pública** com os dados extraídos

### Lógica da Alteração

```typescript
const handleUploadDocumento = async (index: number, file: File) => {
  // ... upload existente ...
  
  // NOVO: Se for CRLV, chamar OCR para extrair dados do veículo
  if (doc.tipo === 'crlv' && result.url && token) {
    try {
      // Chamar OCR
      const { data: ocrData } = await supabase.functions.invoke('document-ocr', {
        body: { url: result.url }
      });
      
      // Se conseguiu extrair dados do CRLV
      if (ocrData?.sucesso && ocrData?.tipo_detectado === 'crlv' && ocrData?.dados) {
        const dados = ocrData.dados;
        
        // Atualizar cotação com dados extraídos
        await atualizarCotacao.mutateAsync({
          token,
          updates: {
            veiculo_cor: dados.cor || undefined,
            // Outros campos que podem ser atualizados:
            // veiculo_placa: dados.placa || undefined,
            // (já devem estar preenchidos da consulta de placa)
          },
        });
        
        toast.success('Dados do veículo extraídos automaticamente!');
      }
    } catch (ocrError) {
      // Não bloquear o fluxo se OCR falhar
      console.warn('OCR do CRLV falhou, continuando sem extração automática');
    }
  }
};
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/public/CotacaoPublicaCompleta.tsx` | Chamar OCR após upload do CRLV e atualizar dados do veículo |

---

## Detalhes Técnicos

### Campos que podem ser extraídos do CRLV (via OCR)

Conforme prompt do `document-ocr/index.ts`:
- `placa` - formato ABC1234 ou ABC1D23
- `renavam` - 11 dígitos
- `chassi` - 17 caracteres alfanuméricos
- `marca` - ex: TOYOTA, VOLKSWAGEN
- `modelo` - ex: COROLLA XEI, GOL 1.0
- `ano_fabricacao` - número inteiro
- `ano_modelo` - número inteiro
- **`cor`** - ex: PRATA, PRETO, BRANCO
- `combustivel` - ex: FLEX, GASOLINA

### Campo já existente na tabela

O tipo `CotacaoPublicaData` já inclui `veiculo_cor?: string` (linha 65), então não há necessidade de alterar schema.

### Tratamento de Erros

O OCR é executado de forma **não-bloqueante** - se falhar, o upload continua normalmente. Isso garante que o cliente não fique preso se houver problema na extração automática.

---

## Resultado Esperado

1. Cliente faz upload do CRLV na jornada pública
2. Sistema extrai automaticamente a **cor** (e outros dados) do documento
3. Dados são salvos na cotação pública
4. Diretor vê os dados completos do veículo no painel
