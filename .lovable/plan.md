

# Remover seção "Anexos do Regulador" da tela de Análise de Sinistro

## O que será feito

Remover o card "Anexos do Regulador" que exibe uma lista de documentos (atualmente vazia/sem uso), mantendo apenas as seções relevantes da vistoria do regulador: fotos, vídeo, diagnóstico, orçamento e parecer.

## Alteração

### Arquivo: `src/pages/eventos/SinistroAnalise.tsx`

- Remover o bloco do card "Anexos do Regulador" (linhas 902-985) que contém o título "Anexos do Regulador (X)" e a grid de documentos
- Manter intacta a seção que exibe os dados da vistoria do regulador (fotos, vídeo, diagnóstico, etapas de reparo, itens do orçamento, parecer) que já existe logo abaixo

### Resultado visual

Antes:
- Card "Anexos do Regulador (0)" com "Nenhum documento anexado"
- Fotos do Regulador
- Vídeo do Regulador
- Diagnóstico, Etapas, Orçamento, Parecer

Depois:
- Fotos do Regulador
- Vídeo do Regulador
- Diagnóstico, Etapas, Orçamento, Parecer

Apenas um bloco de código será removido, sem impacto em nenhuma outra funcionalidade.

