

# Substituir "Aprovar Sinistro" por "Enviar Link de Auto Vistoria" na pagina de Analise de Sinistro

## Problema

Na pagina `SinistroAnalise.tsx`, o botao "Aprovar Sinistro" aparece para sinistros que ainda nao passaram pela etapa de auto vistoria. O fluxo correto e primeiro enviar o link de auto vistoria ao associado (informando sobre coparticipacao), e so depois aprovar.

Isso ja foi feito na pagina de Solicitacoes IA, mas deve valer para **todos** os sinistros, independente de terem vindo da IA ou nao.

## Solucao

### 1. Arquivo: `src/pages/eventos/SinistroAnalise.tsx`

**Substituir botao "Aprovar Sinistro" (linhas 786-793)**

O botao atual chama `AprovarSinistroDialog` que invoca `aprovar-sinistro` (muda status para "aprovado" e envia termo). Para o fluxo correto, deve-se:

- Trocar o botao "Aprovar Sinistro" por **"Enviar Link de Auto Vistoria"** para sinistros que ainda nao tiveram o link enviado (status `comunicado` ou `aberto`)
- Adicionar informacao sobre coparticipacao: "A IA informara ao associado sobre a cota de coparticipacao ao enviar o link."
- Ao clicar, chamar a edge function `gerar-link-evento` (ja existe) para gerar o token, e depois `whatsapp-send-text` para enviar o link ao associado
- Manter o botao "Aprovar Sinistro" original para sinistros que ja passaram pela etapa de vistoria (status mais avancados onde aprovar faz sentido)

**Adicionar logica de envio do link de auto vistoria**

Criar uma nova funcao `handleEnviarLinkAutoVistoria` que:
1. Invoca `gerar-link-evento` com o `sinistro_id`
2. Monta a mensagem WhatsApp com as 3 etapas (fotos, B.O., relato) e link
3. Envia via `whatsapp-send-text`
4. Atualiza o status do sinistro para `em_analise`
5. Registra no historico

**Adicionar nota de coparticipacao acima do botao**

Exibir um alerta informativo azul (igual ao da pagina IA):
```
A IA informara ao associado sobre a cota de coparticipacao ao enviar o link.
```

### 2. Arquivo: `src/components/sinistros/AprovarSinistroDialog.tsx`

Manter este dialog como esta, pois ele sera usado apenas para sinistros em estagio avancado (pos-vistoria). Nenhuma alteracao necessaria.

## Detalhes tecnicos

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/eventos/SinistroAnalise.tsx` | Substituir botao "Aprovar" por "Enviar Link de Auto Vistoria" para sinistros em status inicial (comunicado/aberto), adicionar handler que chama `gerar-link-evento` + `whatsapp-send-text`, adicionar info coparticipacao, manter "Aprovar" para status avancados |

A logica condicional sera:
- Status `comunicado` ou `aberto` (sem vistoria): exibir "Enviar Link de Auto Vistoria"
- Demais status (ja com vistoria realizada): manter "Aprovar Sinistro" como esta

