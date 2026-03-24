

# Avaliação Automática de Cobertura nas Instalações

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/hooks/useCoberturaInstalacao.ts` | **Criar** |
| `src/pages/monitoramento/InstalacoesList.tsx` | **Editar** |
| `src/pages/monitoramento/InstalacaoDetalhe.tsx` | **Editar** |

## Detalhes

### 1. `useCoberturaInstalacao.ts` — Novo hook

Recebe `{ cidade, uf, status, instalador_id }`. Se `instalador_id` preenchido ou status em `['concluida','cancelada','em_andamento','em_rota']`, retorna `tipo: null` sem chamar RPC. Caso contrário, usa `useCoberturaCidade(cidade, uf)` e classifica:

- `tem_comum` → `'coberta_comum'`
- `!tem_comum && tem_prestador` → `'area_prestador'`
- `fora_de_cobertura` → `'fora_cobertura'`

Exporta `{ tipo, isLoading, cobertura }`.

### 2. `InstalacoesList.tsx` — Badge na coluna Endereço

Criar componente interno `CoberturaBadgeCell` que recebe `cidade, uf, status, instalador_id`, chama `useCoberturaInstalacao` e renderiza:

- `area_prestador` → Badge laranja "Área Prestador"
- `fora_cobertura` → Badge vermelha "Sem Cobertura"
- Demais → nada

Inserir após `{inst.bairro}, {inst.cidade}` (linha ~297), ao lado do badge "Viagem" existente. React-query deduplicará chamadas para a mesma cidade/UF.

### 3. `InstalacaoDetalhe.tsx` — Header + Card Instalador

**Header** (linha ~229): Adicionar badge de cobertura ao lado do badge de status existente.

**Card Instalador** (linhas ~405-411): Quando `tipo === 'area_prestador'` ou `tipo === 'fora_cobertura'`, substituir o bloco "Não atribuído" + botão "Atribuir Instalador" por mensagem informativa:
- Cenário B: "Esta cidade é atendida por vistoriador prestador"
- Cenário C: "Esta cidade não possui cobertura — atribuição manual necessária"
- Placeholder para painel VP-M02

