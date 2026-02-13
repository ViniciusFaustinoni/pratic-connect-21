
# Fix: Mensagem WhatsApp ao Concluir OS

## Problema
Ao concluir a OS, a mensagem WhatsApp enviada ao associado nao informa claramente que ele deve comparecer na oficina para buscar o veiculo. A mensagem atual apenas diz que o veiculo esta pronto e menciona o email para assinatura, sem informar endereco da oficina nem orientacao de comparecimento.

Alem disso, o envio pode estar falhando silenciosamente caso o objeto `associado` nao tenha o campo `telefone` preenchido corretamente, mas a base mostra que o telefone existe (`21992593830`).

## Solucao

### Arquivo: `src/components/oficinas/OSConclusaoModal.tsx` (linhas 89-91)

Reescrever a mensagem WhatsApp para incluir:
- Informacao clara de que o veiculo esta pronto para retirada
- Nome e endereco da oficina para comparecimento
- Horario de funcionamento (se disponivel)
- Instrucao para comparecer na oficina

Mensagem proposta:
```
Ola [nome]!

Informamos que o reparo do seu veiculo [marca modelo] placa [placa] foi concluido com sucesso!

Por favor, compareça na oficina [nome oficina] para retirar seu veiculo.
Endereco: [endereco oficina]

Voce recebera um Termo de Saida para assinatura digital antes da liberacao.

Em caso de duvidas, entre em contato conosco.

ABP PraticCar
```

Tambem adicionar log de debug antes do envio para facilitar depuracao futura, e garantir que o endereco da oficina seja incluido na mensagem (buscando campos como `endereco`, `cidade`, `bairro` da oficina).

### Verificar query da oficina

Confirmar que a query em `useOrdemServico` busca `oficina:oficinas(*)` (todos os campos), o que ja inclui endereco. Nenhuma alteracao necessaria na query.

## Resumo
- 1 arquivo alterado: `src/components/oficinas/OSConclusaoModal.tsx`
- Reescrita da mensagem WhatsApp (linhas 89-91) para incluir orientacao de comparecimento e endereco da oficina
- Adicionar log de debug com telefone e dados do associado antes do envio
