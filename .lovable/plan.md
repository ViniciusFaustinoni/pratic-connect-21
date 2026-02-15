

# Incluir documentos necessarios na mensagem do link de auto vistoria

## Problema

A mensagem WhatsApp enviada ao associado com o link de auto vistoria nao detalha os documentos que ele precisa providenciar. O associado precisa saber exatamente o que enviar em cada etapa.

## Solucao

### Arquivo: `src/pages/eventos/SinistroAnalise.tsx` (linha 319)

Atualizar a mensagem WhatsApp para incluir a lista de documentos necessarios em cada etapa:

```
Ola [nome]!

Seu sinistro [protocolo] foi registrado com sucesso.

Para dar andamento ao processo, acesse o link abaixo e envie os documentos necessarios:

[link]

*DOCUMENTOS NECESSARIOS:*

📸 *Etapa 1 - Auto Vistoria (fotos do veiculo)*
- Frente, traseira, laterais e teto
- Detalhes dos danos
- Painel/hodometro
- Minimo de 5 fotos

📋 *Etapa 2 - Boletim de Ocorrencia*
- Numero do B.O.
- Foto ou PDF do documento

📝 *Etapa 3 - Relato do ocorrido*
- Descricao detalhada do que aconteceu
- Audio ou texto
- Localizacao do evento

⚠️ *Importante:* Voce sera informado sobre a cota de coparticipacao aplicavel.

O link e valido por 72 horas.

ABP PraticCar
```

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/eventos/SinistroAnalise.tsx` | Atualizar mensagem WhatsApp (linha 319) para incluir lista detalhada de documentos necessarios por etapa |

