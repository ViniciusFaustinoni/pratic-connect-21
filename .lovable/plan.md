

## Plano: Unificar Substituições dentro de Processos Operacionais

### Problema
- "Substituição de Placa" e "Substituição de Veículo" são tratadas como coisas separadas nos Processos, mas na prática são o mesmo processo
- Já existe uma aba "Substituições" separada no sidebar do Cadastro (`/cadastro/substituicoes`) com página dedicada
- Redundância: 3 lugares tratando substituição (aba Placa, aba Veículo no Processos, e página Substituições separada)

### O que será feito

1. **Remover as abas "Placa" e "Veículo" do ProcessosOperacionais**
   - Remover `SubstituicaoPlacaTab` e `SubstituicaoVeiculoTab`
   - Remover os summary cards de Placa e Veículo
   - A página fica com apenas 2 abas: **Titularidade** e **Reativação**
   - Ajustar grid dos summary cards de 4 para 2 colunas

2. **Mover a aba "Substituições" para dentro de Processos**
   - Remover o item separado "Substituições" do sidebar (`AppSidebar.tsx`)
   - Adicionar uma 3ª aba **"Substituições"** no ProcessosOperacionais que renderiza o conteúdo da página `SubstituicoesPendentesPage` inline (ou redireciona para ela)
   - Adicionar summary card com contagem de substituições pendentes (da tabela `substituicoes_veiculo`)

3. **Ajustar rotas**
   - Manter `/cadastro/substituicoes` e `/cadastro/substituicoes/:id` funcionando (são usadas internamente)
   - Remover entrada do sidebar para que o acesso seja via Processos

### Arquivos alterados

1. `src/pages/cadastro/ProcessosOperacionais.tsx` — remover abas Placa/Veículo, adicionar aba Substituições com conteúdo inline
2. `src/components/layout/AppSidebar.tsx` — remover item "Substituições" do menu Cadastro

