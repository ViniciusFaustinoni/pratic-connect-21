
# Local de Instalacao do Rastreador - Plano de Implementacao

## Situacao Atual

- A tabela `rastreadores` ja possui as colunas `local_instalacao`, `descricao_instalacao` e `foto_local_instalacao_url`, mas elas **nunca sao preenchidas**.
- Na Etapa 3 (Fotos) do checklist de instalacao, ja existe uma foto obrigatoria do tipo `local_rastreador`, mas ela fica na tabela `vistoria_fotos` e nao e copiada para o rastreador.
- Na Etapa 5 (Decisao), o instalador seleciona o rastreador e conclui, mas nao ha campos para informar onde fisicamente o equipamento foi instalado.
- O `RastreadorDetailDrawer` e o `RastreadorCard` nao exibem essas informacoes.

## O que sera feito

### 1. Adicionar campos de local na Etapa 5 do InstaladorChecklist

Na Etapa 5, **apos a selecao do rastreador e antes do botao de concluir**, adicionar:

- **Local de Instalacao** (Select padronizado): opcoes como "Painel", "Sob o banco", "Para-choque dianteiro", "Para-choque traseiro", "Caixa de roda", "Vao do motor", "Console central", "Porta-malas", "Outro"
- **Descricao do ponto** (Textarea obrigatoria): campo livre para descrever com precisao onde esta o equipamento
- Esses campos so aparecem quando `veiculoPrecisaRastreador && decisaoInstalador !== 'negado'`

Novos estados: `localInstalacao` e `descricaoInstalacao`

Validacao: ambos campos obrigatorios no `handleConcluirInstalacao` e no botao disabled

### 2. Passar dados para o hook useAprovarVeiculoServico

Atualizar a interface do `mutationFn` para aceitar `localInstalacao`, `descricaoInstalacao` e buscar a URL da foto `local_rastreador` da vistoria.

No corpo do mutation, ao atualizar o rastreador (linhas 914-922 do useServicos.ts), incluir:

```typescript
.update({
  status: 'instalado',
  veiculo_id: data.veiculoId,
  portador_id: null,
  local_instalacao: data.localInstalacao,
  descricao_instalacao: data.descricaoInstalacao,
  foto_local_instalacao_url: data.fotoLocalUrl,
  updated_at: agora,
})
```

Para obter a `foto_local_instalacao_url`, buscar na tabela `vistoria_fotos` a foto do tipo `local_rastreador` associada ao servico/vistoria atual.

### 3. Exibir no RastreadorDetailDrawer

Na aba "info", apos a secao "Informacoes do Equipamento" e antes de "Veiculo Associado", adicionar uma secao **"Local de Instalacao"** (visivel apenas quando status = instalado e houver dados):

- Icone MapPin + titulo "Local de Instalacao"
- Badge com o local padronizado (ex: "Painel")
- Descricao do ponto de instalacao
- Miniatura clicavel da foto do local (abre em modal/nova aba)

### 4. Exibir no RastreadorCard

Para rastreadores com status `instalado`, adicionar uma linha abaixo do veiculo/associado:

```
MapPin icon | "Painel - Sob o volante, lado esquerdo"
```

Texto truncado com tooltip para descricao completa.

## Arquivos Modificados

1. **`src/pages/instalador/InstaladorChecklist.tsx`** - Adicionar campos de local/descricao na Etapa 5, validacao, e passar para o mutation
2. **`src/hooks/useServicos.ts`** - Aceitar e persistir `localInstalacao`, `descricaoInstalacao`, `fotoLocalUrl` no update do rastreador
3. **`src/components/rastreadores/RastreadorDetailDrawer.tsx`** - Nova secao "Local de Instalacao" na aba info
4. **`src/components/rastreadores/RastreadorCard.tsx`** - Linha com local de instalacao para rastreadores instalados

## Sem migracoes SQL

As colunas `local_instalacao`, `descricao_instalacao` e `foto_local_instalacao_url` ja existem na tabela `rastreadores`. Nenhuma alteracao de schema e necessaria.
