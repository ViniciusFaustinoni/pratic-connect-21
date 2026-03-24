

# Ações Pós-Conclusão da Vistoria Prestador (VP-M03)

## Resumo

Criar uma edge function `concluir-vistoria-prestador` que encadeia 6 ações ao prestador finalizar a vistoria na tela pública. A página `VistoriaPrestador.tsx` passa a chamar essa edge function em vez de fazer update direto.

## Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/concluir-vistoria-prestador/index.ts` | **Criar** — Edge function com as 6 ações |
| `src/pages/public/VistoriaPrestador.tsx` | **Editar** — Chamar edge function no handleConfirmConcluir |

## Edge Function `concluir-vistoria-prestador`

**Input**: `{ token, checklist_data, fotos_vistoria, assinatura_url }`

### Ação 1 — Atualizar status da instalação

Buscar o `vistoria_prestador_links` pelo token. Obter `instalacao_id`. UPDATE na `instalacoes` com `status: 'concluida'`.

### Ação 2 — Invalidar o token

UPDATE em `vistoria_prestador_links` com `status: 'concluida'`, `concluida_em`, `checklist_data`, `fotos_vistoria`, `assinatura_url`. Qualquer acesso futuro ao token retorna Estado 2.

### Ação 3 — Salvar evidências

Os dados já são persistidos na Ação 2 (checklist_data, fotos_vistoria, assinatura_url). As fotos e assinatura já estão no Storage (`vistoria-prestador-fotos`) — o upload ocorre durante o preenchimento na tela pública. A edge function apenas garante que os dados finais estão salvos no registro.

### Ação 4 — Atualizar lançamento financeiro

Buscar o `lancamentos_contabeis` com `origem: 'vistoria_prestador'` e `origem_id: link.id`. Adicionar `complemento` com data/hora de conclusão e referência ao link de execução. O status não muda para "Pago" — permanece "ativo" (previsto) para aprovação manual do financeiro.

### Ação 5 — Notificar coordenador via WhatsApp

Buscar dados completos da instalação (veículo, cidade, placa) e do prestador. Buscar o `atribuido_por` (profile) do link para obter o telefone do coordenador. Enviar mensagem WhatsApp formatada via `whatsapp-send-text` com o template de conclusão especificado.

### Ação 6 — Notificação interna no painel

Inserir em `notificacoes_sistema` com:
- `titulo`: "✅ Vistoria Prestador Concluída"
- `mensagem`: descritiva com prestador, veículo, placa, cidade
- `destino`: 'role' (para atingir coordenadores de monitoramento)
- `destino_role`: role adequada do coordenador
- `tipo`: 'vistoria_prestador_concluida'
- `link`: `/monitoramento/instalacoes/{instalacao_id}`

### Auditoria

Registrar em `logs_auditoria` a conclusão pelo prestador.

## `VistoriaPrestador.tsx` — Alteração

No `handleConfirmConcluir` (linhas ~278-304), substituir o update direto por:

```typescript
const { data, error } = await publicSupabase.functions.invoke('concluir-vistoria-prestador', {
  body: { token, checklist_data: checklist, fotos_vistoria: fotosMap, assinatura_url: assinaturaUrl }
});
```

Remover o update direto em `vistoria_prestador_links`. O resto do fluxo (invalidação de query, toast, estados) permanece igual.

