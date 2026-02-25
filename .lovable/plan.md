

# Reformular Stats Bar da Página de Cotações

## Objetivo
Substituir os 4 KPIs atuais (Total, Enviadas, Aceitas, Conversão) por contadores dos 9 status reais do fluxo de cotação, conforme solicitado.

## Status a exibir
1. **Rascunho** - cotações com `status = 'rascunho'`
2. **Link Enviado** - cotações com `status = 'enviada'`
3. **Escolhendo Plano** - cotações com `status_contratacao = 'escolhendo_plano'` ou `'plano_escolhido'`
4. **Enviando Documentos** - cotações com `status_contratacao = 'enviando_documentos'` ou `'dados_preenchidos'`
5. **Assinando Contrato** - cotações com `status_contratacao = 'assinando_contrato'`
6. **Pagando Taxa** - cotações com `status_contratacao = 'pagando_taxa'`
7. **Agendando Vistoria** - cotações com `status_contratacao = 'agendando_vistoria'`
8. **Em Análise** - cotações com `status_contratacao = 'em_analise'`
9. **Fechado** - cotações com `status = 'aceita'` ou `status_contratacao = 'concluido'`

## Detalhes Técnicos

### Arquivo: `src/pages/vendas/Cotacoes.tsx`

1. **Reformular o objeto `stats`** (linhas 552-564): Calcular contagem para cada um dos 9 status, usando os campos `status` e `status_contratacao` das cotações já carregadas.

2. **Redesenhar a Stats Bar** (linhas 606-648): Trocar o grid 2x4 por um layout horizontal com scroll (ou grid responsivo) mostrando 9 mini-cards compactos, cada um com:
   - Icone colorido representativo
   - Contagem numérica em destaque
   - Label do status abaixo

3. **Layout responsivo**: Usar `flex overflow-x-auto` para permitir scroll horizontal em mobile, mantendo todos os 9 status visíveis em desktop com grid ou flex-wrap.

4. **Cores por status**: Cada status terá uma cor distinta (cinza para Rascunho, azul para Link Enviado, indigo para Escolhendo Plano, cyan para Enviando Docs, purple para Assinando Contrato, amber para Pagando Taxa, orange para Agendando Vistoria, yellow para Em Análise, green para Fechado).

Nenhuma alteração em banco de dados ou outros arquivos é necessária -- os dados de `status` e `status_contratacao` já existem nas cotações carregadas pelo hook `useCotacoes`.
