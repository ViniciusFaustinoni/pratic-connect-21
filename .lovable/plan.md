

# Plano: Corrigir perda silenciosa de documentos (CNH/CRLV)

## Diagnóstico

O problema está em `UnifiedDocumentUploader.tsx` (linhas 212-214). Quando o upload para o Storage e o OCR funcionam mas o **INSERT na tabela `contratos_documentos` falha**, o erro é apenas logado no console. O documento aparece como "sucesso" (checkmark verde) na interface, mas nunca é salvo no banco. Ao navegar para outra etapa ou recarregar, o documento desaparece.

Isso explica por que o usuário viu os documentos como enviados com sucesso durante o fluxo de cotação, mas eles não aparecem na tela de proposta.

## Solução

### 1. Tornar o erro de INSERT visível e tentar novamente (`UnifiedDocumentUploader.tsx`)
- Quando `insertError` ocorrer, **não ignorar silenciosamente**.
- Implementar retry automático (1 tentativa extra) antes de marcar como erro.
- Se falhar no retry, marcar o documento como `error` no estado local (com mensagem clara) em vez de `success`.
- Mostrar toast de erro informando que o documento precisa ser reenviado.

### 2. Adicionar fallback de recuperação
- Se o upload no Storage funcionou mas o INSERT falhou, tentar recuperar na próxima vez que o componente carregar, verificando arquivos no storage sem registro no banco.

### 3. Melhorar feedback visual
- Documentos com falha de persistência devem mostrar ícone de alerta amarelo (não checkmark verde).
- Adicionar botão "Tentar novamente" no card do documento com erro.

## Arquivo modificado
- `src/components/contratos/UnifiedDocumentUploader.tsx` -- tratar erro de INSERT + retry + feedback visual

