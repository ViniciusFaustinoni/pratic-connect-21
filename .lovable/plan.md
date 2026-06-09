# Mostrar Antigo × Novo direto na proposta (Troca / Substituição)

## Contexto
Em `/cadastro/propostas/:id` já existe uma **aba lateral** "Troca" / "Substit." (em `PropostaDetalhesTabs`) que carrega `TrocaProcessoCard` / `SubstituicaoProcessoCard` com o lado antigo e o novo. Como é uma aba (não a default) o operador não percebe — o pedido é deixar essa informação **sempre visível**, sem precisar clicar.

## O que muda
Em `src/pages/cadastro/PropostaAnalise.tsx`, **logo abaixo do `PropostaHeroHeader`** (antes das observações), renderizar:

- Se `proposta.processoOrigem?.tipo === 'troca_titularidade'` → `<TrocaProcessoCard solicitacaoId={…} />`
- Se `proposta.processoOrigem?.tipo === 'substituicao'` → `<SubstituicaoProcessoCard solicitacaoId={…} />`

Os dois cards já mostram exatamente o que o pedido cita:
- **Troca**: titular antigo (snapshot) × novo titular (dados da cotação) + status do termo.
- **Substituição**: veículo antigo (snapshot) × novo veículo (cotação) + associado.

Para evitar duplicação, **remover a aba "Processo"** de `PropostaDetalhesTabs` (e o `TabsContent` correspondente) — passa a viver como bloco fixo no topo. Os dois cards de origem (componente, hook e dados) permanecem intactos.

## Fora de escopo
- Não tocar em regras, edges ou banco.
- Não alterar os componentes `TrocaProcessoCard` / `SubstituicaoProcessoCard` (são read-only e já funcionam).
- Mobile/desktop iguais — os cards já são responsivos.

## Resultado
Operador do Cadastro abre a proposta e já vê, no topo, "Antigo × Novo" do processo de origem, sem precisar navegar entre abas.
