

# Adicionar Etapas de Agendamento e Cota na Mensagem WhatsApp e no Stepper

## Problema

A mensagem WhatsApp enviada ao associado lista apenas 3 etapas (Vistoria, B.O., Relato), sem mencionar as etapas 4 (Agendamento) e 5 (Cota de Coparticipacao). O associado precisa saber o passo a passo completo desde o inicio.

Alem disso, o stepper na pagina publica do evento ja possui 5 etapas, mas a mensagem nao reflete isso.

## Solucao

### 1. Mensagem WhatsApp completa com todas as etapas

No `EventoLinkCard.tsx`, adicionar as etapas 4 e 5 na mensagem:

```
1. *Auto Vistoria* - Envie fotos do veiculo conforme orientacoes
2. *Boletim de Ocorrencia* - Envie o B.O. registrado
3. *Relato Completo* - Descreva como aconteceu o evento
4. *Agendamento* - Agende a vistoria presencial
5. *Cota de Coparticipacao* - Pagamento da cota conforme seu plano
```

Essas duas ultimas etapas serao fixas para todos os tipos de sinistro, adicionadas apos as etapas especificas do tipo.

### 2. Ajuste na construcao da mensagem

As etapas 4 e 5 serao concatenadas automaticamente apos as etapas especificas do tipo, mantendo a numeracao correta.

## Detalhes Tecnicos

### `src/components/eventos/EventoLinkCard.tsx`

Na funcao `handleWhatsApp`, apos montar as etapas especificas do tipo (linhas 89-91), adicionar as etapas comuns de Agendamento e Cota antes de montar o texto final:

- Adicionar ao array de etapas: `'Agendamento'` e `'Cota de Coparticipacao'`
- Adicionar ao array de descricoes: `'Agende a vistoria presencial'` e `'Pagamento da cota conforme seu plano'`
- Isso garantira que a numeracao fique correta (ex: 4. Agendamento, 5. Cota)

| Arquivo | Alteracao |
|---|---|
| `src/components/eventos/EventoLinkCard.tsx` | Adicionar etapas 4 (Agendamento) e 5 (Cota de Coparticipacao) na mensagem WhatsApp |

