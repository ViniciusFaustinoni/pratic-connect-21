

## Plano: Validar placa do CRLV contra a placa da cotação

### O que muda
Quando a IA reconhece um CRLV, a placa extraída será comparada com a placa da cotação. Se forem diferentes, o documento será **bloqueado** com status de erro, exibindo um aviso claro e permitindo reenvio.

### Alterações técnicas

**1. `src/components/contratos/UnifiedDocumentUploader.tsx`**
- Adicionar prop `placaEsperada?: string` na interface
- Após o OCR retornar `tipo_detectado === 'crlv'`, comparar `ocrResult.dados.placa` com `placaEsperada` (normalizando: sem traços, uppercase)
- Se divergirem: marcar documento como `error` com mensagem "A placa do CRLV (XXX) não corresponde à placa da cotação (YYY). Envie o CRLV do veículo correto."
- Não salvar no banco nem notificar dados extraídos quando a placa não bater
- Exibir alerta visual (ícone + texto vermelho) com botão de reenvio

**2. `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`**
- Buscar a placa da cotação via query ao banco (já tem `cotacaoId`)
- Passar `placaEsperada` ao `UnifiedDocumentUploader`

**3. `src/components/contratos/ContratoWizard.tsx`**
- Passar `placaEsperada` da cotação ao `UnifiedDocumentUploader` (já tem acesso aos dados da cotação)

### Escopo
- 3 arquivos frontend modificados
- Sem alterações em Edge Functions ou migrations

