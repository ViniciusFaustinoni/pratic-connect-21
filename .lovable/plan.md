

## Investigação: Erro Non-2xx do CRLV na Edge Function document-ocr

### Diagnóstico Realizado

A investigação revelou que:

1. **OCR está funcionando corretamente**: Consulta ao banco de dados mostrou 5 registros de CRLV com `ocr_resultado` válido e completo
   - Todos com `sucesso: true`
   - Todos com `tipo_detectado: crlv`
   - Dados extraídos corretamente: cor, combustível, motor, placa, renavam, chassi
   - Confiança entre 0.99 e 1.0

2. **Não há logs de erro recentes** na edge function `document-ocr`
   - Tentativas de buscar logs diretos retornaram vazio
   - Logs analíticos também vazios

3. **A função está respondendo com 2xx**: Os documentos CRLV no banco têm `ocr_resultado` preenchido, o que indica que a edge function processou com sucesso

### Possíveis Cenários

**Cenário 1: Erro intermitente/específico**
- O erro pode estar ocorrendo em um cenário específico não reproduzido nos últimos uploads
- Pode estar relacionado ao tipo de arquivo (PDF vs JPEG)
- Pode estar relacionado à qualidade/tamanho da imagem

**Cenário 2: Erro na chamada (não na edge function)**
- O erro pode estar no cliente (UnifiedDocumentUploader ou CotacaoPublicaCompleta)
- Validação de URL bloqueando URLs de storage (linhas 278-293 da document-ocr)
- Timeout na requisição

**Cenário 3: Erro de autenticação**
- Token JWT expirado ou inválido na requisição pública
- URL de storage não reconhecida como válida

### Investigação Recomendada

Para diagnosticar precisamente o erro non-2xx, é necessário:

1. **Reproduzir o erro**: Fazer upload de um CRLV na interface pública ou interna e monitorar:
   - Request/response no DevTools
   - Logs do browser console
   - Status code exato retornado
   - Response body com mensagem de erro

2. **Verificar os logs em tempo real**: 
   - Usar `supabase--edge-function-logs` imediatamente após o erro ocorrer
   - Verificar status code específico (429, 402, 403, 500, etc.)

3. **Validar cenários**:
   - Upload de PDF vs JPEG
   - URLs de storage vs base64
   - Com autenticação vs público
   - Com dados esperados (cpfEsperado, nomeEsperado) vs sem

### Ação Necessária

Para avançar, você poderia:

**Opção A: Reproduzir e Monitorar** (recomendado)
- Fazer upload de um CRLV na cotação pública
- Capturar exatamente qual é o erro e status code
- Compartilhar os logs ou screenshot do erro

**Opção B: Análise de Code Path**
- Descrever o fluxo específico onde o erro ocorre
- Se é ao salvar cotação, processar contrato, ou visualizar documento

**Opção C: Implementar Melhorias Defensivas**
- Adicionar retry logic na chamada da edge function
- Melhorar tratamento de erros com feedback mais específico
- Adicionar logging mais detalhado

### Dados Importantes Encontrados

```json
{
  "crlv_recente": {
    "placa": "LTB4J74",
    "renavam": "00543591115",
    "chassi": "9BRBD48E6E2617010",
    "combustivel": "FLEX",
    "cor": "AZUL",
    "confianca": 0.99
  }
}
```

Todos os CRLVs testados extraíram dados com sucesso, indicando que a edge function está operacional.

