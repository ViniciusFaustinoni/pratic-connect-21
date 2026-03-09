

# Perguntar Endereço ao Abrir Manutenção/Retirada

## Problema Atual

- **AbrirManutencaoModal**: Cria o serviço de manutenção sem perguntar onde será feito. O endereço só é definido depois, no `AgendarManutencaoModal`.
- **Criação de Retirada** (`useCriarRetirada`): Sempre usa o endereço cadastrado do associado automaticamente, sem perguntar.
- **AgendarManutencaoUnificadoModal**: Já tem a lógica de endereço (cadastrado vs outro), mas só aparece após escolher `localTipo = 'rota'`.

O usuário quer que **na abertura** do serviço já se pergunte: "É no endereço cadastrado ou em outro endereço?"

## Alterações

### 1. `AbrirManutencaoModal.tsx`
Adicionar seção de endereço após o campo "Motivo":
- RadioGroup com duas opções: "Endereço cadastrado" (mostra endereço do associado) e "Outro endereço"
- Se "Outro", mostrar campos CEP (com busca automática via ViaCEP), logradouro, número, bairro, cidade, UF
- Passar os dados de endereço no `handleSubmit` para o hook `useAbrirVistoriaManutencao`

### 2. `useVistoriaManutencao.ts` — hook `useAbrirVistoriaManutencao`
Aceitar campos opcionais de endereço alternativo no `AbrirManutencaoParams` e gravar no serviço criado (campos `logradouro`, `numero`, `bairro`, `cidade`, `uf`, `cep`).

### 3. `useCriarRetirada.ts`
Aceitar parâmetro opcional `enderecoAlternativo` em `CriarRetiradaParams`. Se fornecido, usar esse endereço em vez do cadastrado ao criar o serviço.

### 4. Onde a retirada é criada na UI
Identificar o componente que chama `useCriarRetirada` e adicionar a mesma pergunta de endereço (cadastrado vs outro) antes de submeter. Pela busca, `useCriarRetirada` é usado indiretamente — a retirada é criada como `vistoria_retirada` e depois agendada via `AgendarRetiradaModal` que **já tem** a lógica de endereço. Porém o `AgendarRetiradaModal` só mostra o campo de endereço quando `localTipo === 'volante'`. A correção aqui é: sempre mostrar a pergunta "endereço cadastrado ou outro?" no `AgendarRetiradaModal`, independente de ser base ou volante, pois o serviço vai ser feito onde o veículo está.

### 5. `AgendarRetiradaModal.tsx`
Mover a seção de endereço para fora do condicional `localTipo === 'volante'` — sempre perguntar se é no endereço cadastrado ou outro, já que a retirada é sempre no local do veículo.

### 6. `AgendarManutencaoUnificadoModal.tsx`
Já tem a lógica de endereço dentro de `localTipo === 'rota'`. Mesma correção: sempre mostrar a pergunta de endereço quando não for "base", ou seja, manter como está (já funciona corretamente neste modal).

## Resumo de Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/monitoramento/manutencao/AbrirManutencaoModal.tsx` | Adicionar seção endereço (cadastrado vs outro) com campos CEP |
| `src/hooks/useVistoriaManutencao.ts` | Aceitar endereço alternativo no `AbrirManutencaoParams` |
| `src/components/monitoramento/retirada/AgendarRetiradaModal.tsx` | Mostrar pergunta de endereço sempre (não só quando volante) |

