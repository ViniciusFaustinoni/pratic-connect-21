

## Plano: Integrar Assinatura do Laudo na Pagina de Acompanhamento Existente

### Contexto
Atualmente, apos a conclusao da instalacao, o WhatsApp envia um link separado (`/checklist-instalacao/:token`). O correto e enviar o mesmo link de acompanhamento original (`/acompanhar/:token`), porem com uma nova etapa que exibe o checklist + botao para assinar o laudo no Autentique.

### Alteracoes

**1. `src/pages/public/AcompanhamentoProposta.tsx`**
- Adicionar na query `useAcompanhamentoProposta` a busca dos campos do laudo no servico: `laudo_autentique_url`, `laudo_assinado`, `laudo_assinado_em`, `checklist_data`, `ressalvas_instalador`, `fotos_ressalva`, `video_360_url`, `vistoria_fotos`
- Expandir a interface `ServicoInstalacao` com esses campos
- Adicionar nova secao na UI (apos o card de "Assinatura da Instalacao" existente) com:
  - **Checklist de Servicos**: renderiza `checklist_data` com status OK/NOK/ressalva
  - **Avarias Identificadas**: `ressalvas_instalador` + fotos de ressalva
  - **Midia Visual**: galeria de fotos filtradas (exclui `instalacao`, `local_rastreador`, `assinatura_cliente`)
  - **Botao "Assinar Laudo de Instalacao"**: redireciona ao `laudo_autentique_url`
  - **Estado "Laudo Assinado"**: badge verde quando `laudo_assinado = true`
- Adicionar `getStatusInfo` com prioridade para estado `pendente_assinatura_laudo` quando servico concluido + `laudo_autentique_url` presente + `laudo_assinado = false`
- Realtime subscription na tabela `servicos` para detectar `laudo_assinado` mudando para `true`

**2. `src/hooks/useServicos.ts`**
- Alterar `useAprovarVeiculoServico`: trocar o link enviado via WhatsApp de `/checklist-instalacao/:token` para `/acompanhar/:token` (o link original da cotacao)

**3. Limpeza**
- Remover a rota `/checklist-instalacao/:token` de `App.tsx`
- Remover `src/pages/public/ChecklistInstalacaoPublica.tsx` (conteudo migrado para AcompanhamentoProposta)

### Fluxo atualizado
```text
Tecnico conclui instalacao
  → Laudo PDF gerado + enviado ao Autentique
  → WhatsApp com link /acompanhar/:token (mesmo link original)
    → Associado abre link
      → Ve nova etapa: checklist, avarias, fotos
      → Clica "Assinar Laudo" → Autentique
        → Assina → Webhook → laudo_assinado = true
          → Pagina atualiza automaticamente
```

### Arquivos
- **Editar**: `src/pages/public/AcompanhamentoProposta.tsx` (nova secao de checklist/laudo)
- **Editar**: `src/hooks/useServicos.ts` (trocar link WhatsApp)
- **Editar**: `src/App.tsx` (remover rota `/checklist-instalacao`)
- **Remover**: `src/pages/public/ChecklistInstalacaoPublica.tsx`

