

# Remover Edição Inline dos Detalhes do Rastreador

## Contexto

A edição inline dos campos "Número de Série" e "ID na Plataforma" foi adicionada no dialog de detalhes do rastreador, mas isso compromete a idoneidade do processo. Esses campos devem ser somente leitura neste contexto -- apenas o Coordenador de Monitoramento e o Diretor podem modificá-los, e somente pela aba de "Cadastro e Controle".

## Alterações

**Arquivo: `src/components/monitoramento/estoque/DetalhesRastreadorDialog.tsx`**

1. Substituir os dois `EditableInfoRow` (Número de Série e ID na Plataforma) por `InfoRow` simples (somente leitura)
2. Remover os estados `editandoCampo` e `valorEditado`
3. Remover as funções `handleIniciarEdicao`, `handleSalvarCampo`, `handleCancelarEdicao`
4. Remover o componente `EditableInfoRow` (não será mais utilizado)
5. Remover imports não utilizados: `Input`, `Pencil`, `Check`, `X`, `useCallback`, `useQueryClient`

## Resultado

Os campos continuarão exibindo os valores vindos do banco (ou "-" quando vazios), mas sem possibilidade de edição direta. O `id_plataforma` será preenchido automaticamente pelo fluxo de ativação (Parte 1 já implementada), e correções manuais seguirão o fluxo correto via aba de Cadastro e Controle com as devidas permissões.

