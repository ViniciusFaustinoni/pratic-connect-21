

# Mover Assinatura da Instalação do App do Instalador para o Link Público

## Contexto
Atualmente, a assinatura do associado é coletada no app do instalador (Etapa 4 do `InstaladorChecklist`). O pedido é:
1. **Remover** a etapa de assinatura do app do instalador
2. **Adicionar** uma etapa de "Assinatura da Instalação" no **link público de acompanhamento** (`/acompanhar/:token`)
3. Quando o instalador **finaliza a instalação**, enviar **WhatsApp ao associado** com link para assinar
4. Criar **template Meta** para essa notificação
5. **Manter** o envio de fotos/vídeos/documentos ao monitoramento para aprovação

## Alterações

### 1. `src/pages/instalador/InstaladorChecklist.tsx` — Remover etapa de assinatura

- Remover etapa 4 ("Assinatura") do array `ETAPAS` — ficam: Dados, Checklist, Fotos, Decisão (4 etapas)
- Remover todo o bloco `{etapaAtual === 4 && ...}` (a seção de SignaturePad)
- Remover `assinaturaUrl` dos estados e do `podeAvancar()`
- Remover imports de `SignaturePad` e `useSaveAssinatura`
- Ajustar numeração das etapas (Decisão passa de 5 para 4)
- Na Etapa de Decisão: mostrar aviso informativo: "Ao concluir, o associado receberá um link por WhatsApp para assinar digitalmente a instalação"

### 2. `src/hooks/useServicos.ts` (`useAprovarVeiculoServico`) — Enviar WhatsApp após conclusão

- Após a conclusão bem-sucedida da instalação (após registrar histórico, ~linha 1126):
  - Buscar `telefone` do associado e `link_token` do contrato
  - Invocar edge function `whatsapp-send-text` com template `assinatura_instalacao_v1` contendo link `/acompanhar/:token` (o link público já existente)
  - Atualizar campo `servicos.status` ou flag para indicar "pendente_assinatura_cliente" (usar o status existente `concluida` — a assinatura fica como pendência adicional, não bloqueia o fluxo de monitoramento)

### 3. `src/pages/public/AcompanhamentoProposta.tsx` — Nova seção de assinatura

- Quando a instalação está `concluida` e o serviço **não tem** `assinatura_cliente_url`:
  - Mostrar card "Assinatura da Instalação" com:
    - Explicação: "O técnico finalizou a instalação. Por favor, assine abaixo para confirmar"
    - Componente `SignaturePad` adaptado (já existe)
    - Ao salvar: upload para storage + update em `servicos.assinatura_cliente_url` + salvar em `vistoria_fotos`
  - Manter a lógica existente de status (em_analise vai pra monitoramento normalmente)
- Quando já tem `assinatura_cliente_url`: mostrar badge "✓ Assinatura concluída"
- Buscar dados de serviço (com `assinatura_cliente_url`) junto com os dados existentes da query

### 4. `supabase/functions/notificar-assinatura-instalacao/` — Nova edge function (ou usar inline no hook)

Na verdade, usar diretamente `whatsapp-send-text` a partir do hook no client é mais simples e segue o padrão existente. Não precisa de edge function dedicada.

### 5. Template Meta WhatsApp — `assinatura_instalacao_v1`

Criar template para aprovação na Meta:
- **Nome:** `assinatura_instalacao_v1`
- **Categoria:** UTILITY
- **Idioma:** pt_BR
- **Corpo:** `Olá {{1}}! A instalação do rastreador no seu veículo {{2}} foi concluída com sucesso. ✅ Para finalizar o processo, acesse o link abaixo e assine digitalmente confirmando a instalação.`
- **Botão:** CTA tipo URL com `{{1}}` → link de acompanhamento
- **Parâmetros:** [nome_associado, veiculo_modelo_placa]

### 6. Ajuste na query de `AcompanhamentoProposta`

- Na query `useAcompanhamentoProposta`, além dos dados já buscados, buscar também:
  - `servicos` vinculados ao contrato com `tipo = 'instalacao'` e `status = 'concluida'`
  - Campo `assinatura_cliente_url` do serviço
- Adicionar ao interface `AssociadoData` os campos de serviço necessários

## Fluxo resultante

```text
Instalador conclui (sem assinatura)
  → WhatsApp enviado ao associado com link
  → Monitoramento recebe fotos/vídeos/docs para aprovação (mantido)
  → Associado acessa /acompanhar/:token
  → Vê card de "Assinatura da Instalação"
  → Assina no celular
  → Assinatura salva no serviço + vistoria_fotos
```

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/instalador/InstaladorChecklist.tsx` | Remover etapa 4 (assinatura), ajustar numeração, adicionar aviso |
| `src/hooks/useServicos.ts` | Enviar WhatsApp após conclusão da instalação |
| `src/pages/public/AcompanhamentoProposta.tsx` | Adicionar card de assinatura quando instalação concluída |
| `src/hooks/useAssinatura.ts` | Nenhuma mudança — reutilizado pelo link público |

