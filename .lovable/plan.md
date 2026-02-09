
# CancelarAssociadoDialog — Formulario Completo de Cancelamento

## Resumo

Criar um dialog completo de cancelamento que substitui o AlertDialog basico atual. O novo componente orquestra todas as integracoes (processar-pos-retirada, ASAAS, Autentique, WhatsApp) em sequencia, com progress steps visiveis e tratamento de erros resiliente.

## Arquivos Envolvidos

### Novo
- `src/components/cadastro/CancelarAssociadoDialog.tsx` — Dialog completo de cancelamento

### Modificados
- `src/pages/cadastro/AssociadoDetalhe.tsx` — Substituir AlertDialog pelo novo componente
- `supabase/functions/disparar-notificacao/index.ts` — Adicionar template de cancelamento (tipo `cobranca`, subtipo `cancelamento`)

### Nao alterados
- `SuspenderAssociadoDialog` — intacto (usado apenas como referencia visual)
- `RastreadorVinculadoModal` — intacto
- `useAssociados.ts` — intacto
- `useAsaas.ts` — intacto
- `processar-pos-retirada/index.ts` — intacto
- `autentique-create/index.ts` — intacto

---

## Passo 1 — CancelarAssociadoDialog.tsx

### Props
```typescript
interface CancelarAssociadoDialogProps {
  open: boolean;
  onClose: () => void;
  associado: { id: string; nome: string; status: string; pendencia_rastreador: boolean };
  onSuccess: () => void;
}
```

### Layout (mesmo padrao do SuspenderAssociadoDialog)

1. **Checklist automatica no topo** (busca dados ao abrir):
   - Rastreador devolvido: le `associado.pendencia_rastreador`
   - Situacao financeira: consulta `asaas_cobrancas` com status PENDING/OVERDUE

2. **Bloqueio** se `pendencia_rastreador = true`:
   - Alert destructive com mensagem explicativa
   - Botao "Confirmar Cancelamento" permanece desabilitado

3. **Formulario** (quando sem pendencia):
   - Select com 8 motivos (solicitacao_associado, insatisfacao, concorrente, venda_veiculo, dificuldade_financeira, mudanca_cidade, falecimento, outro)
   - Input texto livre quando "Outro" selecionado (obrigatorio)
   - Textarea observacoes (opcional, max 500 chars)

4. **Card financeiro**:
   - Total em aberto (soma de PENDING + OVERDUE da `asaas_cobrancas`)
   - Pro-rata estimado (dias restantes do mes x mensalidade diaria, calculado com dados do contrato/plano)
   - Info: "Sera gerado boleto final consolidado"

5. **Checkboxes obrigatorios**:
   - Confirmo cancelamento
   - Sera gerado termo via Autentique

6. **Footer**: Voltar (outline) + Confirmar Cancelamento (destructive, desabilitado ate preencher tudo)

### Fluxo ao confirmar (handleCancelamento)

Executa em sequencia com progress steps visiveis:

```text
Passo 1: Chamar processar-pos-retirada (motivo = cancelamento_voluntario)
  - Se falhar: toast.error, parar
  
Passo 2: Cancelar cobrancas ASAAS futuras
  - Buscar asaas_cobrancas com status PENDING e data_vencimento > hoje
  - Para cada: supabase.functions.invoke('asaas-cobrancas', { action: 'cancelar', asaas_id })
  - Atualizar associado: asaas_recorrencia_cancelada = true
  - Se falhar: marcar asaas_recorrencia_cancelada = false, registrar erro, continuar

Passo 3: Gerar boleto final (se valor > 0)
  - Usar useAsaas.criarCobranca com tipo 'boleto_final_cancelamento'
  - Valor = debitos em aberto
  - Atualizar associado: boleto_final_gerado = true
  - Se falhar: registrar erro, continuar

Passo 4: Gerar termo Autentique
  - Chamar autentique-create com contratoId do associado
  - Se falhar: registrar erro, continuar (termo pode ser gerado depois)

Passo 5: Notificar WhatsApp
  - Chamar disparar-notificacao com tipo 'cobranca', subtipo 'cancelamento'
  - Se falhar: registrar erro, continuar

Passo 6: toast.success + onSuccess()
```

### Progress Steps UI

Enquanto processa, substituir o formulario por lista de steps:
```text
[spinner] Processando cancelamento...
[spinner] Cancelando cobrancas futuras...
[spinner] Gerando boleto final...
[spinner] Gerando termo de cancelamento...
[spinner] Enviando notificacao...
[check] Concluido!
```

Cada step muda de spinner para check verde ao completar, ou X vermelho se falhar (com mensagem).

---

## Passo 2 — Integrar na AssociadoDetalhe.tsx

### Mudancas pontuais

1. Importar `CancelarAssociadoDialog`
2. Remover o bloco `AlertDialog` de cancelamento (linhas 1616-1631)
3. Adicionar no JSX:
```tsx
<CancelarAssociadoDialog
  open={cancelarDialogOpen}
  onClose={() => setCancelarDialogOpen(false)}
  associado={{
    id: id || '',
    nome: associado.nome,
    status: associado.status,
    pendencia_rastreador: (associado as any).pendencia_rastreador || false,
  }}
  onSuccess={() => { setCancelarDialogOpen(false); refetch(); }}
/>
```

4. Simplificar `handleCancelar`: remover toda logica de verificacao de rastreador e cancelamento direto -- o novo dialog cuida de tudo internamente. O botao de "Cancelar Associacao" no dropdown agora apenas abre `setCancelarDialogOpen(true)`.

5. Manter `handleConfirmRastreadorModal` e `RastreadorVinculadoModal` intactos (sao usados para o fluxo de retirada quando ha rastreador instalado).

**Observacao importante**: A logica de verificacao de rastreador instalado (que abre o `RastreadorVinculadoModal`) sera movida para DENTRO do `CancelarAssociadoDialog` -- quando o usuario clica "Confirmar" e ha rastreador instalado, o dialog fecha e abre o modal de rastreador. Isso mantem o fluxo existente sem alterar o `RastreadorVinculadoModal`.

---

## Passo 3 — Template de cancelamento no disparar-notificacao

Adicionar no objeto `TEMPLATES` dentro da edge function:

```typescript
// Dentro de 'cobranca':
cancelamento: {
  titulo: 'Cancelamento Processado',
  mensagem: 'Olá! Seu cancelamento na Praticcar foi processado. Termo de cancelamento enviado para assinatura. {complemento_boleto}Obrigado por ter sido nosso associado!',
  prioridade: 'alta'
},
```

Tambem adicionar `'cobranca'` ao type union de `tipo` no `NotificacaoRequest` (ja esta la).

Deploy da edge function apos alteracao.

---

## Validacoes e edge cases

- Se `processar-pos-retirada` falhar: para tudo, nao continua
- Se ASAAS falhar: continua, marca `asaas_recorrencia_cancelada = false`
- Se Autentique falhar: continua, log no console
- Se WhatsApp falhar: continua, log no console
- Se nao ha debitos em aberto: pula geracao de boleto final
- Se associado nao tem contrato/cotacao vinculados: pula Autentique com warning
- Botao desabilitado durante processamento (previne double-click)
