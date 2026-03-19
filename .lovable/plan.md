

# Bloqueio de Mudança de Linha (Carro ↔ Moto) na Substituição

## Problema
O `StepNovoVeiculo` permite que o associado substitua um carro por uma moto (ou vice-versa) sem nenhuma verificação. Isso viola a regra de "mudança de linha de produto" configurada em Regras de Venda (chave `restricao_mudanca_linha` na tabela `configuracoes`).

## Solução

### Arquivo: `src/components/substituicao/StepNovoVeiculo.tsx`

Após a consulta FIPE retornar os dados do novo veículo (marca/modelo preenchidos):

1. **Detectar tipo do veículo antigo** usando `useDetectarTipoVeiculo(veiculoAntigo.marca, veiculoAntigo.modelo)`
2. **Detectar tipo do veículo novo** usando `useDetectarTipoVeiculo(dados.marca, dados.modelo)`
3. **Buscar config** `restricao_mudanca_linha` da tabela `configuracoes` (já existe o pattern em `useConteudosSistema.ts` com `useRestricoesAbsolutas`)
4. **Comparar tipos** — se diferem (carro→moto ou moto→carro):
   - Se `restricao_mudanca_linha === true`: exibir Alert destrutivo com mensagem de bloqueio absoluto e desabilitar botão "Próximo"
   - Se `restricao_mudanca_linha === false`: exibir Alert de aviso (amarelo) mas permitir prosseguir

### Mensagem de bloqueio
> "Mudança de linha de produto não é permitida no processo de substituição. O veículo atual é um **[carro/moto]** e o novo é um **[moto/carro]**. Para trocar de linha, é necessário cancelar o veículo atual e realizar uma nova adesão."

### Mensagem de aviso (quando config desativada)
> "Atenção: o veículo atual é um **[carro/moto]** e o novo é um **[moto/carro]**. Mudança de linha detectada, mas a restrição está desativada nas configurações."

### Impacto no botão "Próximo"
A variável `camposObrigatorios` (linha 108) será complementada com a verificação:
```
const bloqueioMudancaLinha = tiposDiferentes && restricaoAtiva;
// Botão disabled quando bloqueioMudancaLinha === true
```

### Hooks reutilizados (sem alteração)
- `useDetectarTipoVeiculo` — já existe em `src/hooks/useDetectarTipoVeiculo.ts`
- `useRestricoesAbsolutas` — já existe em `src/hooks/useConteudosSistema.ts`, retorna `{ mudanca_linha: boolean }`

### Nenhuma migration necessária
A chave `restricao_mudanca_linha` já existe na tabela `configuracoes`.

