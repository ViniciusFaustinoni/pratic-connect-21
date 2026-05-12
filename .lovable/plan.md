# Plano para corrigir o badge de Propostas Pendentes

## Objetivo
Fazer o número exibido no menu lateral de **Propostas Pendentes** refletir exatamente a mesma fila mostrada em **Cadastro > Propostas Pendentes**.

## O que vou fazer
1. **Mapear a origem da divergência**
   - O badge atual usa `usePropostasPendentesCount()` e conta todos os contratos com `status = 'assinado'`.
   - A tela `/cadastro/propostas` usa `usePropostasPendentes()` e remove itens já concluídos, já aprovados na autovistoria, com instalação concluída ou já fora da fila operacional.

2. **Unificar a lógica de contagem com a lógica da lista**
   - Ajustar o badge para usar a mesma fonte da lista, evitando contagem simplificada por status bruto.
   - Preferência: reutilizar `usePropostasPendentes()` e derivar `length` para o sidebar, ou extrair uma base compartilhada para que lista e badge dependam da mesma regra.

3. **Preservar performance e consistência**
   - Garantir que a solução use React Query de forma reaproveitável, sem duplicar consultas pesadas desnecessariamente.
   - Manter invalidação/refetch coerentes para que badge e tela atualizem juntos.

4. **Validar o resultado**
   - Conferir que o badge do menu passa a bater com a quantidade real da tela.
   - Verificar especialmente o caso reportado: sidebar mostrando 80 enquanto a lista mostra 27.

## Resultado esperado
- O badge do sidebar exibirá o número real da fila de Cadastro.
- Não haverá mais diferença entre o total do menu e o total exibido na página.

## Detalhes técnicos
- Arquivos já identificados:
  - `src/hooks/usePropostasPendentesCount.ts`
  - `src/hooks/usePropostasPendentes.ts`
  - `src/components/layout/AppSidebar.tsx`
- Causa encontrada:
  - `usePropostasPendentesCount()` faz apenas `.eq('status', 'assinado')` em `contratos`.
  - `usePropostasPendentes()` aplica a regra completa de negócio da fila antes de montar a lista.
- Direção da correção:
  - Eliminar a contagem “bruta” por status para esse badge.
  - Fazer o badge depender da mesma regra de filtragem já usada pela tela.