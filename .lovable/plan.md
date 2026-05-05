## Problema

No KWM9443 (e qualquer associado aberto via `/cadastro/associados`), clicar nos documentos anexados não abre nada. Causa: a listagem renderiza `<AssociadoDetalhe>` dentro de um `<Dialog>` Radix (Associados.tsx L971-993). Quando o usuário clica no ícone "olho" da tabela de documentos, o `MediaViewerModal` (outro `Dialog`) tenta abrir como portal aninhado e fica bloqueado pelo overlay do dialog externo (`pointer-events`). Os arquivos existem e as URLs são públicas — confirmado no banco.

## Mudanças

### 1. `src/pages/cadastro/Associados.tsx`
- Substituir abertura do detalhe em modal por navegação para a rota dedicada que já existe (`/cadastro/associados/:id`, registrada em `App.tsx` L518).
- `handleAssociadoClick`: trocar `setDetalheAssociadoId(associado.id)` por `navigate(\`/cadastro/associados/\${associado.id}\`)`.
- Substituir os 5 `onClick={() => setDetalheAssociadoId(associado.id)}` (linhas 740, 755, 759, 763, 767) por `navigate(...)`.
- Remover o bloco `<Dialog>` de detalhe (L970-993), o estado `detalheAssociadoId` e o import não usado (`AssociadoDetalhe`, `AssociadoDetalheErrorBoundary`, `Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription` se não usados em outro lugar).

### 2. `src/pages/cadastro/AssociadoDetalhe.tsx`
- Endurecer o botão "olho" da tabela de documentos (L900-913): adicionar um botão extra "abrir em nova aba" (`<a target="_blank">`) ao lado, como fallback robusto. Mantém o `MediaViewerModal` como visual principal.

## Validação

1. `/cadastro/associados` → buscar KWM9443 → clicar na linha → navega para `/cadastro/associados/{id}`.
2. Aba **Documentos** → clicar no olho → `MediaViewerModal` abre com PDF/imagem.
3. Botão "Ver Contrato Assinado" e "Galeria do Instalador" funcionam normalmente.

## Arquivos afetados

- `src/pages/cadastro/Associados.tsx`
- `src/pages/cadastro/AssociadoDetalhe.tsx`
