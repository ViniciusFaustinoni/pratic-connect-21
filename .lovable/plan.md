
Objetivo confirmado: eliminar de vez a assinatura duplicada no Termo de Filiação (e padronizar para os demais termos), mantendo somente:

- título “ASSINATURA”
- data/local com espaçamento maior
- sem bloco manual “associado / PraticCar”

Diagnóstico do que está acontecendo hoje (com base no código e dados atuais):
1) O fluxo de filiação por token (`autentique-create-by-token`) ainda adiciona a seção de assinatura sempre, sem validação de conteúdo já assinado.
2) O template padrão ativo de filiação no banco (`documento_templates`, código `AF1`) contém trechos finais com assinatura manual (ex.: linha com `{{associado.nome}} - CPF: {{associado.cpf}}`), então ele já leva uma “área de assinatura” embutida.
3) Resultado: o conteúdo do template + assinatura padrão adicionada pela função = 2 áreas.
4) Além disso, no fallback hardcoded de filiação (`_shared/termo-afiliacao-template.ts`) ainda existe assinatura no aditivo de rastreador, o que pode gerar duplicidade em cenários de fallback.

Implementação proposta (ajuste definitivo, sem depender do template “estar limpo”):
1) Centralizar detecção/limpeza de assinatura manual em utilitário compartilhado
- Arquivo: `supabase/functions/_shared/template-utils.ts`
- Adicionar helper para:
  - detectar se conteúdo já contém área/linhas de assinatura manual (classes `signature-*`, título “ASSINATURA”, linhas com nome+CPF em bloco de assinatura, etc.)
  - limpar blocos manuais conhecidos quando necessário (especialmente blocos que representam assinatura de associado/empresa)
- Manter uma única função para “decidir se injeta assinatura padrão” para evitar divergência entre edge functions.

2) Corrigir filiação por token (principal ponto do bug reportado)
- Arquivo: `supabase/functions/autentique-create-by-token/index.ts`
- Hoje ele injeta assinatura padrão sem checagem.
- Ajustar para usar a mesma regra robusta do utilitário compartilhado:
  - primeiro sanitiza conteúdo manual duplicado
  - depois só injeta assinatura padrão se realmente não existir assinatura válida no documento final
- Também aplicar a checagem considerando conteúdo + aditivos (não só um trecho isolado).

3) Alinhar filiação normal (sem token) para a mesma regra robusta
- Arquivo: `supabase/functions/autentique-create/index.ts`
- A lógica atual checa apenas alguns sinais (`signature-block`, `signature-line`, `ASSINATURA`), o que é insuficiente para casos como “nome + CPF”.
- Substituir por checagem compartilhada mais completa + sanitização.

4) Eliminar duplicidade no fallback hardcoded de filiação
- Arquivo: `supabase/functions/_shared/termo-afiliacao-template.ts`
- Remover a área de assinatura do “Termo de Responsabilidade - Equipamento Rastreador” (aditivo), deixando assinatura apenas no fechamento principal.
- Assim, mesmo em fallback, permanece 1 única área de assinatura.

5) Aplicar a mesma política aos demais termos (padronização pedida)
- Arquivos:
  - `supabase/functions/autentique-cancelamento-create/index.ts`
  - `supabase/functions/autentique-evento-create/index.ts`
  - `supabase/functions/autentique-os-saida-create/index.ts`
  - `supabase/functions/autentique-vistoria-create/index.ts`
- Padronizar fluxo:
  - sanitiza assinatura manual duplicada do conteúdo dinâmico
  - injeta assinatura padrão somente quando ausente
- Isso previne regressão caso algum template do banco volte a trazer bloco manual.

6) Validação funcional (end-to-end)
- Cenários de teste obrigatórios:
  1. Filiação via fluxo de cotação/vendas (interno)
  2. Filiação via link público/token
  3. Filiação com e sem aditivos aplicáveis
  4. Cancelamento, Evento, OS Saída e Vistoria com template dinâmico
- Critério de aceite em todos:
  - exatamente 1 área de assinatura visual
  - sem linhas “associado/praticcar” manuais
  - mantendo título + local/data com espaçamento maior

7) Deploy após ajustes
- Deploy das functions alteradas:
  - `autentique-create`
  - `autentique-create-by-token`
  - `autentique-cancelamento-create`
  - `autentique-evento-create`
  - `autentique-os-saida-create`
  - `autentique-vistoria-create`
- `_shared` entra como dependência das funções deployadas.

Risco/mitigação
- Risco: remover assinatura em excesso por regex agressiva.
- Mitigação: sanitização focada em padrões de bloco de assinatura (não em qualquer ocorrência de “CPF” no corpo), e validação visual em todos os fluxos antes de fechar.
