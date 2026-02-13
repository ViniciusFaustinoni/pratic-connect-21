
# Melhorias no Modal de Conclusao de OS

## Problema
O modal de conclusao nao exibe o custo da OS. Alem disso, o campo `whatsapp` do associado nao esta sendo buscado na query, o que pode impedir o envio do WhatsApp.

## Alteracoes

### 1. Adicionar `whatsapp` na query do hook (`src/hooks/useOrdensServico.ts`)
A query de `useOrdemServico` seleciona apenas `id, nome, telefone, email` do associado. Precisa incluir `whatsapp` para o envio funcionar.

```
// De:
associado:associados(id, nome, telefone, email)

// Para:
associado:associados(id, nome, telefone, whatsapp, email)
```

### 2. Exibir custo da OS no modal (`src/components/oficinas/OSConclusaoModal.tsx`)
Adicionar uma secao entre o resumo da OS e o separador mostrando o valor do orcamento:

```
Total Orcamento
R$ 450,00
```

Sera exibido com destaque visual (texto grande, negrito) usando `os.valor_orcamento`. Se houver `valor_aprovado`, exibir tambem.

### 3. Fluxo ja implementado
Os botoes "Enviar Termo para Assinatura" e "Liberar Veiculo" ja existem no modal. O fluxo sequencial (Concluir -> Termo -> Liberar) ja esta correto. Apenas o custo estava faltando.

## Resumo tecnico
- **`src/hooks/useOrdensServico.ts`**: Adicionar campo `whatsapp` na select do associado (linha 71)
- **`src/components/oficinas/OSConclusaoModal.tsx`**: Adicionar bloco de custo antes do Separator (entre linhas 261-263), exibindo `os.valor_orcamento` e opcionalmente `os.valor_aprovado`/`os.valor_pago`
