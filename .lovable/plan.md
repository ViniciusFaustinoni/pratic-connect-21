
Objetivo: corrigir o erro 400 no envio da “Foto do local de instalação”.

Diagnóstico confirmado
- O upload está indo para o bucket `servicos-fotos` em `InstaladorChecklist.tsx`.
- Esse bucket não existe no projeto (consulta em `storage.buckets` retornou vazio para `servicos-fotos`).
- Por isso o Storage responde 400.
- Os logs de `watchPosition: Timeout expired (code 3)` são paralelos e não são a causa do erro de upload da foto.

Plano de implementação
1) Corrigir bucket no upload da foto de instalação
- Arquivo: `src/pages/instalador/InstaladorChecklist.tsx`
- Trocar `.from('servicos-fotos')` por `.from('instalacoes')` em:
  - upload da foto
  - geração de URL pública (`getPublicUrl`)
- Manter o path `local-instalacao/${id}/...` (já adequado para organização).

2) Tornar upload mais robusto para formato de imagem real
- No mesmo handler (`handleFotoLocalInstalacao`):
  - usar `contentType: file.type || 'image/jpeg'` (em vez de fixo `image/jpeg`)
  - gerar extensão com base no tipo (`jpg/png/webp`) para evitar inconsistência entre nome e mime.

3) Melhorar observabilidade do erro
- No `catch`, registrar detalhes reais do erro (`uploadError.message`, `statusCode`) em `console.error`.
- Ajustar toast para mostrar mensagem útil (ex.: “Bucket não encontrado” / “tipo de arquivo inválido” quando aplicável).

4) Verificação funcional após ajuste
- Testar o fluxo na tela de checklist:
  - capturar foto local
  - confirmar toast de sucesso
  - validar que a miniatura aparece
  - confirmar URL salva em `fotoLocalInstalacao` e persistida ao concluir instalação.

Detalhes técnicos
- Causa raiz: referência a bucket inexistente.
- Correção de menor risco: usar bucket já existente (`instalacoes`), que já possui política de staff e já é usado no mesmo arquivo para fotos de ressalva.
- Não é necessário criar nova migração para resolver este bug específico; é uma inconsistência de código cliente.
