

## Registro da regra na memória do projeto

Não é uma mudança de código — é uma **regra de negócio crítica** que precisa ser memorizada para eu (e qualquer sessão futura) nunca mais sugerir "consertar" a ausência dos planos 5% off em SP e Lagos.

## O que vou salvar

### 1) Novo arquivo de memória
`mem://constraints/pricing/regional-discount-plans-exclusion`

Conteúdo:
- **Tipo:** constraint (proibição absoluta)
- **Regra:** Planos com 5% de desconto não existem em `sao_paulo` nem `regiao_lagos`
- **Motivo:** Essas regiões já possuem desconto regional próprio na precificação base — somar 5% causaria desconto duplicado
- **Como aplicar:**
  - Nunca propor reincluir/recriar esses planos nessas regiões
  - Se uma auditoria de catálogo apontar "faltando", tratar como estado correto
  - Vínculos em `planos_regioes` devem cobrir apenas RJ, Interior RJ, Interior SP
  - Ao duplicar linhas com desconto, excluir SP e Lagos do clone automaticamente

### 2) Atualização do `mem://index.md`
- Adicionar uma linha no **Core** (regra universal, aplica em qualquer ação de catálogo/preço):
  > "Planos com 5% de desconto NÃO existem em São Paulo nem Região dos Lagos (essas regiões já têm desconto próprio). Exclusão manual intencional — nunca reincluir."
- Adicionar referência ao novo arquivo na seção **Memories**.

## O que NÃO vou fazer

- Nenhuma mudança em código
- Nenhuma migration / UPDATE no banco
- Nenhuma alteração em `planos_regioes`
- Nenhuma sugestão de "auditoria" para reincluir os planos

Aprovando, eu apenas escrevo os dois arquivos de memória e encerro.

