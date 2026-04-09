

## Plano: Tornar combustível somente-leitura quando detectado pela FIPE

### Problema
Quando a API FIPE retorna o combustível do veículo, o sistema auto-preenche o valor mas mantém o dropdown editável. Isso confunde o usuário, que vê um campo de seleção para um dado que já foi identificado automaticamente.

### Solução
- Quando `veiculoEncontrado?.vehicleData?.combustivel` existe e o combustível foi auto-detectado: exibir como **campo somente-leitura** (texto com badge, sem dropdown)
- Quando não há detecção (preenchimento manual sem placa): manter o dropdown editável como está
- Remover a linha "Detectado via FIPE: ..." que se torna redundante

### Arquivo alterado

**`src/components/cotacoes/CotacaoFormDialog.tsx`** (linhas ~1598-1637)

Substituir o bloco do Select por lógica condicional:

```text
Se veiculoEncontrado?.vehicleData?.combustivel:
  → Exibir Input disabled com o label do combustível + badge "Via FIPE"
Senão:
  → Manter Select dropdown como está (para preenchimento manual)
```

### Nao alterado
- Lógica de auto-detecção (linhas 704-720) — continua preenchendo `combustivelSelecionado`
- Motor de cotação — continua recebendo `combustivelSelecionado` normalmente
- Formulário multi-step (EtapaCategoriaVeiculo) — verificar se tem o mesmo padrão

