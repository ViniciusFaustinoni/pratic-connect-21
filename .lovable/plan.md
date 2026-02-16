

# Atualizar Mensagem da IA sobre Passo a Passo do Sinistro

## O que sera feito

Reescrever a mensagem WhatsApp enviada ao associado quando o sinistro e aprovado pela IA, para incluir:

- Explicacao sobre a auto vistoria (fotos do veiculo)
- Orientacao sobre enviar mais detalhes do ocorrido (B.O.)
- Informacao sobre o prazo de 30 dias para dar entrada
- Tom acolhedor, mostrando que a equipe auxiliara em tudo

## Arquivo a alterar

`supabase/functions/aprovar-solicitacao-ia/index.ts` (linhas 344-356)

## Mensagem atual

```
Ola {nome}!

Seu sinistro {protocolo} foi registrado com sucesso.

Para dar andamento ao processo, acesse o link abaixo e envie os documentos necessarios:

{link}

DOCUMENTOS NECESSARIOS:
Etapa 1 - Auto Vistoria (fotos do veiculo)
Etapa 2 - Boletim de Ocorrencia
Etapa 3 - Relato do ocorrido

O link e valido por 72 horas.
```

## Nova mensagem proposta

```
Ola {nome}!

Seu evento {protocolo} foi registrado com sucesso.
Estamos aqui para te ajudar em cada etapa!

IMPORTANTE: A partir da comunicacao do evento, temos um prazo de *30 dias* para concluir toda a documentacao. Como o prazo ja esta correndo, vamos agilizar juntos!

Acesse o link abaixo para iniciar o processo:

{link}

O QUE VOCE PRECISARA FAZER:

1. *Auto Vistoria* - Voce fara fotos do seu veiculo pelo celular (frente, traseira, laterais, teto e detalhes dos danos). Sao no minimo 5 fotos para registrarmos o estado atual.

2. *Boletim de Ocorrencia* - Envie o numero e foto/PDF do seu B.O. com os detalhes do ocorrido (endereco, data e circunstancias).

3. *Agendamento da Vistoria* - Apos as etapas acima, voce agendara a vistoria presencial.

4. *Cota de Coparticipacao* - Pagamento da cota conforme seu plano.

{cota se aplicavel}

O link e valido por 72 horas. Qualquer duvida, estamos a disposicao!

ABP PraticCar
```

## Detalhes tecnicos

- Remover a "Etapa 3 - Relato do ocorrido" (ja removida do link conforme memoria do projeto)
- Adicionar as etapas 3 (Agendamento) e 4 (Cota) na explicacao
- Incluir o texto sobre prazo de 30 dias
- Manter formatacao WhatsApp nativa (*negrito*)
- Manter a logica de cota condicional (`cotaTexto`)

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/aprovar-solicitacao-ia/index.ts` | Reescrever mensagem WhatsApp (linhas 344-356) com novo texto explicativo incluindo prazo de 30 dias, descricao das 4 etapas e tom acolhedor |

