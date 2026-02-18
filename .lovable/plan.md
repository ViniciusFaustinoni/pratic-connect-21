

# Corrigir dados do sinistro SIN-20260217-0008 e validar fluxo

## Problema identificado

A logica do codigo ja esta implementada corretamente. O menu contextual so exibe "Fazer Pedidos das Pecas" quando as 3 condicoes sao verdadeiras:
- `status = 'aprovado'` (OK)
- `termo_anuencia_assinado = true` (OK)
- `cota_paga = true` (**FALSO no banco**)

O campo `cota_paga` esta como `false` porque o bug do CHECK constraint (corrigido anteriormente) impediu que o pagamento fosse registrado localmente, mesmo tendo sido processado no Asaas.

## Solucao

### 1. Corrigir os dados do sinistro SIN-20260217-0008

Atualizar `cota_paga = true` no banco para refletir a realidade (pagamento ja foi recebido).

```text
UPDATE sinistros SET cota_paga = true WHERE protocolo = 'SIN-20260217-0008';
```

### 2. Confirmar que o fluxo esta correto no codigo

A logica ja implementada no ultimo deploy:

```text
Se (aprovado + cota_paga + termo_assinado):
  -> Exibe APENAS botao "Fazer Pedidos das Pecas"
  -> Card "Controle do Reparo" aparece na coluna direita

Senao:
  -> Exibe menu padrao (Atualizar Status, Agendar Vistoria, etc.)
```

Apos corrigir o `cota_paga`, o sinistro SIN-20260217-0008 passara a exibir o fluxo correto automaticamente.

## Resumo do fluxo completo (ja implementado)

1. **Menu contextual**: Apenas "Fazer Pedidos das Pecas" (abre AtribuirFornecedoresDialog)
2. **Card Controle do Reparo - Fase 1**: Botao "Fazer Pedidos das Pecas"
3. **Fase 2 (pecas_em_cotacao)**: Lista de pecas com fornecedor aprovado, botoes de contato (ligacao/WhatsApp), checkbox "Pedido Realizado"
4. **Fase 2b**: Checkboxes individuais "Peca Chegou" para cada peca
5. **Fase 3**: Todas as pecas chegaram -> Notifica associado via WhatsApp -> Botao "Enviar para Oficina"
6. **Fase 4**: Cria chamado de guincho -> Badge "Pendente de Remocao para Oficina"
7. **Fase 5**: Chamado concluido -> Badge "Veiculo na Oficina" -> Notifica associado

Toda a logica ja esta no codigo. O unico problema e o dado `cota_paga = false` que precisa ser corrigido no banco.

