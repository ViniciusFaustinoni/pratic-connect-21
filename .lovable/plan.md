# 3 ajustes — PDF preview + consultor + tipo adesão/R&F

## #1 — PDF não abre preview na aprovação do Monitoramento

**Onde:** `src/components/troca-titularidade/VeiculoCompletoCard.tsx` (linhas 353–388), modal "Preview de documento" usado tanto na Troca de Titularidade quanto na Aprovação do Monitoramento.

**Causa raiz:** o preview usa `<object data type="application/pdf">`. Em vários navegadores o `<object>` PDF dentro de um `<Dialog>` (com `overflow-hidden` e `max-w` no parent) carrega em branco — o Chrome às vezes não dispara o plugin nativo de PDF e o fallback `<iframe>` Google Docs também falha porque o usuário está autenticado em outra conta Google.

**Correção:**
- Trocar `<object>` por `<iframe src={url}#toolbar=1&navpanes=0>` (o Chromium e o Firefox renderizam PDF nativo direto em iframe, sem o problema do `<object>` em modal).
- Remover o `overflow-hidden` do `DialogContent` que estava cortando a área de render.
- Ajustar a detecção `isPdf` para também aceitar `mime` do contrato (`d.mime_type === 'application/pdf'`) e nomes sem extensão visível na URL (Supabase às vezes retorna sem `.pdf` quando vem de `documentos/`).
- Manter o botão "Abrir em nova aba" como fallback explícito quando o iframe falhar.

Aplicar o mesmo padrão em `src/components/cadastro/VisualizadorDocumentoModal.tsx` (linhas 172–183) — é o mesmo modal usado em outras telas de aprovação e tem o mesmo bug latente.

## #2 — Cadastro › Veículos: coluna "Consultor responsável"

**Onde:**
- `src/hooks/useVeiculos.ts` → `useVeiculosPaginados` (linhas 71–112): incluir o consultor via contrato ativo do veículo.
- `src/pages/cadastro/Veiculos.tsx`: nova coluna `Consultor` na tabela desktop e na linha do card mobile.

**Como puxar o consultor (sem N+1):**
Estender o `.select()` do `useVeiculosPaginados` com:
```
contratos:contratos(
  id, vendedor_id, status, created_at,
  vendedor:profiles!contratos_vendedor_id_fkey(id, nome)
)
```
e, na linha da tabela, escolher o contrato mais recente do veículo (preferindo `status = 'ativo'`; senão o `created_at` mais novo). Mostra `vendedor.nome` ou `—` se não houver.

Cabeçalho atualizado:
```
Veículo | Placa | Ano | Cor | Valor FIPE | Uso App | Associado | Consultor | Status
```

## #3 — Cadastro › Aprovações Pendentes › aba Cliente

**Onde:** `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx`, dentro do `<TabsContent value="cliente">` (linhas 179–243).

O **Tipo de Adesão já existe** na linha 190–195 — manter como está.

Adicionar duas informações novas logo abaixo do bloco do "Tipo de Adesão":

1. **Consultor responsável** — `proposta.vendedor?.nome` (já vem do hook `usePropostasPendentes`, linha 190). Renderizar como `FichaField` com ícone `User` e label "Consultor responsável".
2. **Cobertura de Roubo e Furto** — badge "Sim" (verde) / "Não" (cinza) com base em `proposta.veiculo?.cobertura_roubo_furto`.

**Hook:**
`src/hooks/usePropostasPendentes.ts` hoje já busca `veiculo_*` no select do contrato, mas **não traz** `cobertura_roubo_furto`. Acrescentar `cobertura_roubo_furto` no `.select()` da consulta a `veiculos` (existe em duas branches: lista paginada e detalhe único) e expor como `proposta.veiculo_cobertura_roubo_furto: boolean | null` no tipo `PropostaPendente`.

Layout final da aba Cliente:
```
[ Tipo de Adesão: Reativação ]   [ Consultor: João da Silva ]   [ R&F: Sim ]
Nome | CPF | Telefone | WhatsApp | Email | Endereço ...
```

## Fora de escopo
- Backend / RLS — nenhuma mudança de schema é necessária; todos os campos já existem (`contratos.vendedor_id`, `veiculos.cobertura_roubo_furto`).
- Edge functions intactas.

## Arquivos a editar
- `src/components/troca-titularidade/VeiculoCompletoCard.tsx` (preview PDF)
- `src/components/cadastro/VisualizadorDocumentoModal.tsx` (preview PDF — mesmo bug)
- `src/hooks/useVeiculos.ts` (incluir vendedor no select)
- `src/pages/cadastro/Veiculos.tsx` (coluna Consultor desktop + mobile)
- `src/hooks/usePropostasPendentes.ts` (adicionar `cobertura_roubo_furto` ao select)
- `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx` (Consultor + badge R&F na aba Cliente)
