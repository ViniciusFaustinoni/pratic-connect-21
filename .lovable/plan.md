# Liberar todas as abas do detalhe do associado para o perfil "Analista de Cadastro"

## Diagnóstico

No detalhe do associado (`/cadastro/associados/:id`), a barra de abas é renderizada por `AssociadoTabNav.tsx`. Hoje, a aba **Documentos** tem a flag `hidden: isAnalistaCadastroOnly`, ou seja:

```tsx
{ value: 'documentos', label: 'Documentos', icon: FileCheck, badge: docsPendentes, hidden: isAnalistaCadastroOnly }
```

Resultado: usuários que têm **apenas** o papel `analista_cadastro` (sem nenhum outro perfil privilegiado) não veem essa aba. Todas as outras abas pedidas (Resumo, Dados Pessoais, Veículos, Financeiro, Histórico, WhatsApp) já são visíveis para esse perfil.

## Correção

Remover a restrição da aba Documentos em `src/components/associados/detalhe/AssociadoTabNav.tsx`:

- Linha 30 — tirar `hidden: isAnalistaCadastroOnly` do item `documentos`.
- A prop `isAnalistaCadastroOnly` deixa de ser usada no componente; pode ser removida da interface e da chamada em `AssociadoDetalhe.tsx` (limpeza opcional, sem impacto funcional).

Não há mudança em outros arquivos: o conteúdo da aba (`DocumentosTab`) já é renderizado normalmente quando `activeTab === 'documentos'` em `AssociadoDetalhe.tsx`, sem condicionais por perfil.

## Fora de escopo

- Restrições do `AssociadoHeroHeader` (botões de Troca de Titularidade etc.) permanecem como estão — o pedido foi sobre as **abas** do detalhe.
- Permissões de escrita/edição dentro de cada aba não são alteradas.

## Arquivos afetados

- `src/components/associados/detalhe/AssociadoTabNav.tsx`
- (opcional) `src/pages/cadastro/AssociadoDetalhe.tsx` — remover passagem da prop não usada
