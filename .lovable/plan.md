

## Plano: Remover assinatura do associado na vistoria

### O que muda
A coleta de assinatura digital (rabiscando a tela) será completamente removida do fluxo de vistoria. O laudo de vistoria será apenas gerado, anexado aos documentos do associado e enviado por email ao associado.

### Arquivos afetados

**1. `src/pages/public/VistoriaPrestador.tsx`**
- Remover import do `SignaturePad`
- Remover estado `assinaturaUrl` e `uploadingAssinatura`
- Remover função `handleSignatureSave`
- Remover seção "Assinatura do Associado" (Card inteiro, linhas ~506-541)
- Remover `!!assinaturaUrl` da condição `canFinalize` (ficará apenas checklist + fotos)
- Remover mensagem "Colete a assinatura" do texto de requisitos
- Remover `assinatura_url` do body da mutation de conclusão

**2. `src/pages/public/AcompanhamentoProposta.tsx`**
- Remover o card "Assinatura da Instalação" com SignaturePad (~linhas 1024-1078)
- Remover handler `handleSalvarAssinatura` e estado `salvandoAssinatura` / `assinaturaSalva`

**3. `src/hooks/useAssinatura.ts`**
- Remover tipo `'vistoria'` do `AssinaturaTipo`
- Remover lógica que salva assinatura em `vistoria_fotos` (linhas ~92-100)
- Manter a geração do laudo (que já acontece automaticamente)

**4. `src/hooks/useAssinaturaVistoria.ts`**
- Remover este hook inteiro (não será mais usado, era para assinatura Autentique de vistoria)

**5. Edge Function `concluir-vistoria-prestador`**
- Remover validação de `assinatura_url` obrigatória (se existir)
- Garantir que o laudo é gerado e enviado por email ao concluir

**6. Envio de email do laudo**
- Ao concluir a vistoria, enviar email ao associado com link para download do laudo PDF (usando o hook/função de email existente ou `supabase.functions.invoke`)

### Escopo
- ~6 arquivos modificados (4 frontend + 1-2 Edge Functions)
- Sem migrations necessárias
- O laudo continua sendo gerado automaticamente como já funciona hoje

