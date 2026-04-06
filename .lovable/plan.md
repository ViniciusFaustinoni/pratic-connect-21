

# Plano: Atribuição manual de rastreador no modal de veículo (Base Antiga)

## O que muda para o usuário
Na aba "Rastreador" do modal de detalhes de veículo, quando o veículo não possui rastreador, diretores verão um formulário para vincular manualmente um rastreador disponível (em estoque).

## Implementação

### 1. Criar componente `VincularRastreadorForm` inline na aba Rastreador
- Renderizado quando `!rastreador` e o usuário `isDiretor`.
- Contém um campo de busca com debounce para encontrar rastreadores com `status = 'estoque'` (busca por código, IMEI ou número de série).
- Exibe lista de resultados com código, IMEI, plataforma.
- Botão "Vincular" com confirmação.

### 2. Hook de busca de rastreadores disponíveis
- Criar (ou reutilizar) uma query em `useRastreadores.ts` que busca rastreadores com `status = 'estoque'` filtrados por texto (código/IMEI).
- Query leve, limitada a 10 resultados.

### 3. Ação de vinculação
- Reutilizar `useUpdateRastreadorStatus` já existente, passando `{ id: rastreadorSelecionado, status: 'instalado', veiculo_id: veiculoId }`.
- Após sucesso, invalidar queries do modal para recarregar os dados do rastreador.

### 4. Alterações em `VeiculoDetalhesModal.tsx`
- Importar `usePermissions` e o novo componente/lógica.
- Na aba "rastreador", quando `!rastreador`: se `isDiretor`, mostrar o formulário de vinculação; caso contrário, manter o empty state atual.

## Arquivos modificados
- `src/components/cadastro/VeiculoDetalhesModal.tsx` — adicionar formulário de vinculação na aba rastreador
- `src/hooks/useRastreadores.ts` — adicionar hook de busca de rastreadores em estoque

