

# Mensagem WhatsApp Acolhedora com Explicacao das Etapas

## Problema

A mensagem enviada via WhatsApp ao associado e muito simples e direta, sem explicar o que ele precisa fazer, quais sao as etapas, nem mencionar a cota de coparticipacao. O associado recebe apenas o link sem contexto.

## Solucao

Reescrever a mensagem no `handleWhatsApp` do componente `EventoLinkCard.tsx` (linha 65) para ser acolhedora e informativa, adaptada ao tipo de sinistro.

### Mensagem Atual (linha 65)

```text
Olá {nome}! Segue o link para completar as etapas do seu evento ({protocolo}):
{link}
O link é válido por 72 horas.
ABP PraticCar
```

### Nova Mensagem (adaptada por tipo de sinistro)

A mensagem sera construida dinamicamente com base no `sinistroTipo`:

**Para Colisao/PT (padrao):**
```text
Olá {nome}! Somos da *ABP PraticCar* e estamos aqui para te ajudar nesse momento.

Seu evento *{protocolo}* foi registrado e precisamos que voce complete algumas etapas pelo link abaixo:

1. *Auto Vistoria* - Envie fotos do veiculo conforme orientacoes
2. *Boletim de Ocorrencia* - Envie o B.O. registrado
3. *Relato Completo* - Descreva como aconteceu o evento

Acesse aqui: {link}

O link e valido por *72 horas*.

Apos a conclusao, nossa equipe analisara seu caso. Lembrando que, conforme seu plano, sera aplicada a *cota de coparticipacao* sobre o valor de referencia do veiculo.

Qualquer duvida, estamos a disposicao!

ABP PraticCar
```

**Para Roubo/Furto:**
Etapas adaptadas: B.O., Relato, Documentacao/Chaves

**Para Vidros:**
Etapas adaptadas: Fotos do Dano, Relato Simples (2 etapas)

**Para Fenomeno Natural:**
Etapas adaptadas: B.O. + Fotos, Comprovante + Fotos In Loco, Relato Completo

## Detalhes Tecnicos

### `src/components/eventos/EventoLinkCard.tsx`

Substituir a construcao da `mensagem` na linha 65 por uma funcao que monta o texto dinamicamente com base no `sinistroTipo`, reutilizando a mesma logica de `etapaLabels` ja presente no componente (linhas 89-95).

A funcao tera a seguinte estrutura:
- Saudacao acolhedora com nome
- Protocolo em destaque
- Lista numerada das etapas especificas do tipo de sinistro
- Link
- Validade do link
- Mencao a cota de coparticipacao
- Mensagem de suporte
- Assinatura

Formatacao usando *negrito* do WhatsApp (um asterisco), conforme regra ja implementada.

| Arquivo | Alteracao |
|---|---|
| `src/components/eventos/EventoLinkCard.tsx` | Reescrever mensagem do handleWhatsApp com etapas, cota e tom acolhedor |

