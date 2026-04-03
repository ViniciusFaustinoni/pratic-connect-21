# Nova Aba "Atribuição" em Coberturas e Benefícios

## Resumo

Adicionar uma terceira aba "Atribuição" no componente `CatalogoCoberturasBeneficios` (Gestão Comercial > Coberturas e Benefícios). Essa aba lista todos os planos cadastrados. Ao clicar num plano, abre um modal de busca de associados para atribuí-lo, com opção de enviar ou não o termo de filiação via Autentique.

## Arquivos

### 1. `src/components/gestao-comercial/CatalogoCoberturasBeneficios.tsx`

- Adicionar aba "Atribuição" no `TabsList` existente (ao lado de Coberturas e Benefícios)
- Renderizar o novo componente `AtribuicaoPlanoTab` no `TabsContent`

### 2. `src/components/gestao-comercial/AtribuicaoPlanoTab.tsx` (novo)

- Lista todos os planos ativos (via `usePlanos` hook existente)
- Cada plano mostra: nome, linha, valor mensal, adesão
- Botão "Atribuir" em cada plano abre o modal de atribuição

### 3. `src/components/gestao-comercial/AtribuirPlanoModal.tsx` (novo)

Modal com 2 etapas:

**Etapa 1 — Buscar Associado:**

- Input de busca por nome, CPF ou placa
- Consulta tabela `associados` com filtro
- Exibe resultado em lista clicável (nome, CPF, plano atual se houver)
- Ao selecionar, avança para etapa 2

**Etapa 2 — Confirmar Atribuição:**

- Resumo: plano selecionado + associado selecionado
- Pergunta com radio: "Sem envio do termo de filiação" / "Com envio do termo de filiação (Autentique)"
- Se "Sem envio":
  - Atualiza `associados.plano_id` diretamente
  - Cria registro em `contratos` (numero gerado, plano_id, associado_id, status `ativo`, valores do plano)
  - Toast de sucesso
- Se "Com envio":
  - Cria contrato com status `pendente_assinatura`
  - Invoca `autentique-create-by-token` (edge function existente) para gerar o documento e enviar ao email do associado
  - Ao ser assinado (webhook Autentique já existente atualiza `autentique_status`), o contrato passa para `assinado` e o `plano_id` do associado é atualizado
  - Documento assinado fica acessível na aba Documentos do modal de detalhes do associado (já funcional via tabela `contratos` com campos `pdf_url`/`pdf_assinado_url`)

### 4. `src/hooks/useAtribuirPlano.ts` (novo)

- `useBuscarAssociados(termo)`: busca associados por nome/CPF/placa com debounce
- `useAtribuirPlanoSemTermo()`: mutation que atualiza `associados.plano_id` e cria contrato ativo
- `useAtribuirPlanoComTermo()`: mutation que cria contrato `pendente_assinatura` e invoca a edge function do Autentique

## Fluxo Autentique (com termo)

O sistema já possui a integração completa:

- Edge function `autentique-create-by-token` gera o documento e envia para assinatura
- Contrato criado com `link_token` para rastreio
- Webhook existente atualiza `autentique_status` e `pdf_assinado_url` no contrato
- O PDF assinado já aparece nos documentos do associado (modal de detalhes)

## Impacto

- 1 arquivo modificado (`CatalogoCoberturasBeneficios.tsx`)
- 3 arquivos novos (componente tab, modal, hook)
- 0 migrations (usa estrutura existente de `contratos` e `associados`)