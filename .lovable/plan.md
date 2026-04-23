
## Correção: continuar cotação/rascunho sem perder marca, modelo e ano do veículo

### Problema identificado
A funcionalidade de rascunho já existe em `CotacaoFormDialog.tsx` via `useCotacaoDraft`, então não vou criar outro mecanismo paralelo.

O problema está no que é salvo/restaurado:

- O rascunho local salva `placa`, `marcaSelecionada`, `modeloSelecionado` e `anoSelecionado`.
- Porém, quando o veículo vem pela busca de placa, os dados reais ficam em `veiculoEncontrado.vehicleData`.
- Esse objeto não é salvo no rascunho.
- Ao restaurar/continuar, o sistema recupera a placa, mas não reconstrói `veiculoEncontrado`.
- Como `getMarcaNome()`, `getModeloNome()` e `getAnoNome()` dependem de `veiculoEncontrado` ou das listas FIPE carregadas, o formulário pode ficar sem marca/modelo/ano mesmo com placa e FIPE preenchidos.

Além disso, para cotações já persistidas como `rascunho`, se a cotação foi salva sem `veiculo_marca`, `veiculo_modelo` ou `veiculo_ano`, a tela de detalhes mostra os campos vazios e não tenta reconsultar a placa.

---

## Implementação proposta

### 1. Salvar os dados do veículo encontrado no rascunho local
Arquivo:
- `src/components/cotacoes/CotacaoFormDialog.tsx`

Atualizar o `draftSnapshot` para incluir um snapshot seguro de:
- `veiculoEncontrado`
- `vehicleData`
- `fipeData`

Com isso, quando o consultor sair da tela antes de criar a cotação e depois clicar em restaurar rascunho, o sistema terá novamente:
- marca
- modelo
- ano
- combustível
- cor
- código FIPE
- valor FIPE

### 2. Restaurar `veiculoEncontrado` ao continuar o rascunho
Arquivo:
- `src/components/cotacoes/CotacaoFormDialog.tsx`

No `handleRestoreDraft`, além de restaurar os campos atuais, reconstruir `setVeiculoEncontrado(...)` quando o payload tiver dados de veículo válidos.

Fluxo esperado:
- Se o rascunho tiver `veiculoEncontrado.vehicleData`, restaurar diretamente.
- Se tiver apenas placa e valor FIPE, manter a placa e permitir reconsulta manual.
- Se tiver combustível no veículo, restaurar também `combustivelSelecionado`.

### 3. Evitar que o reset inicial apague o rascunho restaurado
Arquivo:
- `src/components/cotacoes/CotacaoFormDialog.tsx`

Revisar o efeito que limpa o formulário quando o modal abre sem `leadId`, `cotacaoBase` ou edição.

Hoje ele reseta estados ao abrir a cotação rápida. Vou ajustar para não sobrescrever os dados logo após o usuário restaurar um rascunho.

A abordagem será usar uma flag interna, por exemplo:
- `isRestoringDraftRef`

Assim:
- abertura normal continua começando limpa;
- restauração de rascunho não é apagada pelo reset automático.

### 4. Reconsultar dados do veículo quando uma cotação rascunho persistida tiver placa, mas não tiver marca/modelo/ano
Arquivos:
- `src/components/cotacoes/CotacaoDetalhesModal.tsx`
- `src/pages/vendas/Cotacoes.tsx`

Adicionar uma ação clara para cotações em `rascunho`:
- “Continuar cotação” ou reaproveitar o fluxo de edição quando disponível.

Ao abrir o formulário com uma cotação base/rascunho:
- se houver `veiculo_marca` e `veiculo_modelo`, usar os dados salvos;
- se não houver marca/modelo/ano, mas houver `veiculo_placa`, disparar a busca por placa automaticamente ou oferecer um botão de “Buscar dados da placa”.

Isso resolve cotações como a do print, onde a placa aparece (`LTB4J74`), mas marca/modelo/ano estão vazios.

### 5. Garantir que a criação/atualização nunca salve veículo incompleto quando a placa foi encontrada
Arquivo:
- `src/components/cotacoes/CotacaoFormDialog.tsx`

Antes de montar `cotacaoData`, garantir fallback robusto:

- `veiculo_marca`: `getMarcaNome()` ou `veiculoEncontrado.vehicleData.marca`
- `veiculo_modelo`: `getModeloNome()` ou `veiculoEncontrado.vehicleData.modelo`
- `veiculo_ano`: ano extraído de `getAnoNome()` ou `veiculoEncontrado.vehicleData.ano`
- `codigo_fipe`: `veiculoEncontrado.fipeData.codigo`, quando existir

Se a placa foi buscada com sucesso, mas os dados ainda estiverem vazios, bloquear o submit com mensagem amigável:
- “Os dados do veículo ainda não foram carregados. Clique em buscar placa novamente antes de salvar.”

### 6. Melhorar a exibição no modal de detalhes
Arquivo:
- `src/components/cotacoes/CotacaoDetalhesModal.tsx`

Quando marca/modelo/ano estiverem ausentes mas houver placa:
- mostrar um aviso visual discreto:
  - “Dados do veículo não carregados”
- exibir ação:
  - “Continuar e buscar dados”
  
Isso evita parecer que o sistema perdeu dados sem oferecer recuperação.

---

## Validação após implementação

Validar o cenário reportado:

1. Criar/abrir uma cotação em rascunho com placa `LTB4J74`.
2. Interromper o fluxo e restaurar/continuar.
3. Confirmar que o formulário volta com:
   - placa
   - marca
   - modelo
   - ano
   - FIPE
   - combustível
   - plano selecionado quando aplicável
4. Confirmar que ao salvar a cotação, o detalhe exibe corretamente:
   - Toyota
   - Corolla XEi Flex
   - ano do veículo
   - placa `LTB4J74`
5. Confirmar que uma cotação rascunho antiga, já salva apenas com placa, consegue recuperar os dados ao continuar.

---

## Arquivos envolvidos

- `src/components/cotacoes/CotacaoFormDialog.tsx`
- `src/components/cotacoes/CotacaoDetalhesModal.tsx`
- `src/pages/vendas/Cotacoes.tsx`

