# Sino de Pendências de Documentos/Fotos

Adicionar no `AppHeader` um ícone de sino (parecido com o botão de Relatar Erro) que mostra, em tempo real, todas as propostas com `documentos_solicitados.status = 'pendente'` que pertencem ao usuário logado (consultor responsável) ou a qualquer proposta — para perfis de cadastro/gestores. Ao abrir, o consultor vê a lista de pendências por associado e, em cada item, pode copiar/abrir/enviar via WhatsApp o **link público** para o associado cumprir as pendências.

## Comportamento

- Sino fixo no header, à esquerda do `TestarCorrecoesButton`.
- Badge numérico vermelho com a contagem de propostas distintas com pendências.
- Popover (largura ~ 420px) com:
  - Título "Documentos Pendentes" + subtítulo "Cobre o associado para concluir o envio".
  - Lista de cards (1 por proposta/associado pendente):
    - Nome do associado, código da cotação/proposta, placa.
    - Chips com os tipos pendentes (Foto do Motor, CNH, CRLV…) — usando os labels já existentes.
    - Botão **Copiar link**, **Abrir link** (nova aba) e **Enviar WhatsApp** (`wa.me/<telefone>?text=<msg>` com mensagem padrão contendo o link público).
    - Link "Abrir proposta" → navega para o detalhe interno.
  - Estado vazio: "Nenhuma pendência no momento ✅".

## Quem vê

- **Consultor responsável**: filtra pelas propostas onde `cotacoes.vendedor_id = profile.id`.
- **Cadastro/Gestores** (roles `admin`, `diretor`, `gestor_comercial`, `cadastro` — alinhado a quem já enxerga propostas pendentes hoje): vê todas as pendências, sem filtro de vendedor.
- Outros perfis: sino não renderiza.

## Detalhes técnicos

### Hook novo `usePendenciasDocumentos`
- Localização: `src/hooks/usePendenciasDocumentos.ts`.
- Query React Query (`staleTime` ~30s + realtime opcional via `supabase.channel` em `documentos_solicitados`).
- SQL (via supabase-js):
  ```
  documentos_solicitados
    .select('id, tipo_documento, descricao, status, associado_id, contrato_id,
             associados(nome, telefone),
             contratos(id, codigo, vendedor_id, cotacao_id,
                       cotacoes(id, codigo, placa, vendedor_id))')
    .eq('status', 'pendente')
  ```
- Filtro condicional por `vendedor_id` quando o usuário logado não é gestor/cadastro (mesmo padrão de `useFunilCotacao` — ver memória "Funil por vendedor").
- Agrupa por `associado_id` (uma linha por associado), retornando `{ associado, telefone, cotacaoCodigo, contratoId, link, pendencias[] }`.

### Construção do link público
- Reutilizar a mesma rota pública usada hoje no fluxo "Acompanhamento da Proposta" / `cotacao-publica`. Vou identificar o builder existente (`AcompanhamentoProposta` recebe um id/token na URL) e usar a função utilitária correspondente — já existe geração desse link nos pontos onde o consultor envia a proposta. Se houver um `gerarLinkPublicoProposta(contratoId|cotacaoId)`, reutilizar; caso contrário criar helper em `src/lib/links/propostaPublica.ts` montando `https://app.praticcar.org/<rota>/<id>` (Production URL conforme regra de Core).

### Componentes novos
- `src/components/notificacoes/PendenciasDocumentosBell.tsx`
  - Botão `<Button variant="ghost" size="icon">` com `Bell` + `Badge` absoluto.
  - `Popover` (shadcn) com `ScrollArea` para a lista.
  - Itens reutilizam `Badge`/`Card` do design system.
- Integrado em `src/components/layout/AppHeader.tsx` antes do `TestarCorrecoesButton`.

### Permissão
- Usar `useAppRoles`/`usePermissions` para detectar gestor/cadastro.
- Render condicional: se não é gestor/cadastro e não é vendedor (sem `vendedor_id` próprio), não mostra sino.

### Mensagem padrão WhatsApp
```
Olá, {nome}! Sua proposta na Praticcar está com pendências:
- {tipo 1}
- {tipo 2}
Para concluir, acesse: {link_publico}
Qualquer dúvida, estou à disposição.
```

### Realtime (opcional, mas recomendado)
- Subscribe em `documentos_solicitados` (`INSERT`/`UPDATE`) para invalidar a query e atualizar o badge em tempo real, igual a outros listeners do projeto (`VendasNotificationListener`).

## Arquivos a criar/editar

```text
src/hooks/usePendenciasDocumentos.ts             (novo)
src/lib/links/propostaPublica.ts                  (novo, se não existir helper)
src/components/notificacoes/PendenciasDocumentosBell.tsx  (novo)
src/components/layout/AppHeader.tsx               (editar: render do sino)
```

## Não-objetivos

- Não dispara WhatsApp automático via Evolution/Meta (apenas abre `wa.me`).
- Não altera o fluxo de criação/aprovação de pendências.
- Não toca no link público em si — só consome o existente.
