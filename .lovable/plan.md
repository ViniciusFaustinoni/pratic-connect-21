## Objetivo
No card de aprovação do Cadastro (tela `Cadastro > Propostas > Detalhes`, aba **Cliente**), adicionar três informações que hoje não aparecem:

1. **Tipo de Adesão** (Comum / Troca de Titularidade / Substituição / Inclusão de Veículo etc.)
2. **Endereço Residencial** (já existe parcialmente como "Endereço" — vamos rotular explicitamente)
3. **Endereço de Instalação** — quando o associado escolheu um endereço diferente do residencial para a vistoria/instalação

## Onde está hoje
`src/components/cadastro/proposta/PropostaDetalhesTabs.tsx` (aba "Cliente", bloco `Dados do Cliente`, linhas 166-208) já mostra Nome, CPF, Telefone, WhatsApp, Email, **Endereço** (residencial do associado), Nascimento, Estado Civil, Profissão, RG, CNH.

Falta:
- Badge/campo `Tipo de Adesão`
- Renomear "Endereço" → "Endereço Residencial"
- Bloco condicional `Endereço de Instalação` (só renderiza se diferente do residencial)

## Fonte dos dados (banco)
Confirmado via schema:
- `contratos.tipo_entrada` (e `cotacoes.tipo_entrada`) — `'comum' | 'troca_titularidade' | 'substituicao_placa' | 'inclusao' | ...`
- Endereço residencial: já vem de `associados.logradouro/numero/bairro/cidade/uf` (e fallback `contratos.cliente_logradouro/...`)
- Endereço de instalação escolhido no link público: `cotacoes.vistoria_endereco_logradouro / numero / bairro / cidade / estado / cep` (e a variante `vistoria_completa_endereco_*` para sub-FIPE / autovistoria completa). Quando o cliente marcou "vistoria na minha casa", esses campos ficam vazios ou iguais ao residencial; quando escolheu outro endereço, vêm preenchidos com o local agendado.

## Mudanças

### 1. `src/hooks/usePropostasPendentes.ts`
- Estender `interface PropostaPendente` com:
  - `tipo_entrada: string | null`
  - `endereco_instalacao: { logradouro, numero, bairro, cidade, uf, cep } | null`
- Nos `.select(...)` de `contratos` e de `cotacoes` (lista + detalhe), adicionar:
  - `tipo_entrada`
  - `vistoria_endereco_logradouro, vistoria_endereco_numero, vistoria_endereco_bairro, vistoria_endereco_cidade, vistoria_endereco_estado, vistoria_endereco_cep`
  - `vistoria_completa_endereco_logradouro, vistoria_completa_endereco_numero, vistoria_completa_endereco_bairro, vistoria_completa_endereco_cidade, vistoria_completa_endereco_estado, vistoria_completa_endereco_cep`
- Ao montar o objeto, escolher o set não-nulo entre `vistoria_completa_*` (prioridade — sub-FIPE) e `vistoria_*`. Comparar com o endereço residencial; só preencher `endereco_instalacao` se for **diferente** (normalização: trim + lowercase + sem acento no logradouro+número+bairro+cidade).
- `tipo_entrada` deriva primeiro do contrato; fallback para a cotação.

### 2. `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx`
Dentro da aba **Cliente**, no `Dados do Cliente`:
- Adicionar, no topo do grid (antes de Nome), um **badge destacado** `Tipo de Adesão: {label}` usando os rótulos canônicos:
  - `comum` → "Adesão Comum"
  - `troca_titularidade` → "Troca de Titularidade"
  - `substituicao_placa` / `substituicao` → "Substituição de Veículo"
  - `inclusao` → "Inclusão de Veículo"
  - fallback: capitalizar o valor cru
- Renomear o `FichaField` "Endereço" → "Endereço Residencial" (linhas 181-191).
- Logo abaixo, **condicional** (`{proposta.endereco_instalacao && (...)}`) renderizar um segundo `FichaField` "Endereço de Instalação" com ícone `MapPin` em cor `text-info` (para diferenciar visualmente), `className="sm:col-span-2"`, e um pequeno hint `"Endereço diferente do residencial escolhido pelo associado para a instalação"` abaixo.

Nenhuma mudança em backend / edge functions / migrations — só leitura e UI.

## Arquivos a modificar
- `src/hooks/usePropostasPendentes.ts` (tipo + 2 queries de SELECT + montagem do objeto)
- `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx` (aba Cliente — badge + 2 campos de endereço)

## Fora de escopo
- Aba Instalação (que mostra agendamento) — não muda.
- Edge functions de aprovação — não tocam.
- Demais filas (Monitoramento) — não tocam.