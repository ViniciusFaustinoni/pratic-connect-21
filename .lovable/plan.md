## Causa raiz

A redefinição anterior cancelou a autovistoria parcial, mas **não reverteu a ativação que já tinha sido disparada**. O estado atual:

| Entidade | Valor atual | Deveria estar |
|---|---|---|
| `cotacoes.status_contratacao` | `ativo` | `contrato_assinado` |
| `associados.status` | `aguardando_instalacao` | `em_analise` |
| `veiculos.status` | `instalacao_pendente` | `em_analise` |
| `contratos.status` | `assinado` | `assinado` (manter) |
| `contratos.cadastro_aprovado` | `false` (já corrigido) | `false` |

Como `cotacoes.status_contratacao='ativo'`, o `CotacaoContratacao.tsx` (linha 544) força o componente `EtapaCriacaoSenhaCotacao` — daí a tela "**Proteção ativada! Crie sua senha**" que ele está vendo. Não consegue voltar para escolher vistoria.

## O que a correção faz (uma única migração SQL)

1. **`cotacoes` (b50180dc…)** — `status_contratacao = 'contrato_assinado'` → reabre o link na **Etapa 3 — Escolha de Vistoria**, com plano, documentos e contrato preservados como concluídos.
2. **`associados` (d7b2d4c7…)** — `status = 'em_analise'` → tira da fila de instalação e devolve para o estado pré-ativação.
3. **`veiculos` (7719dcaa…)** — `status = 'em_analise'` → mesmo motivo (saí de `instalacao_pendente`).
4. **`contratos`** — mantém `status='assinado'` e `cadastro_aprovado=false` (já corrigido na migração anterior). Sem mexer em `ativado_em` para preservar trilha.

Nenhuma alteração em código frontend/backend — o gate de fila do Cadastro (autovistoria precisa estar completa) já está no lugar pela correção anterior, então a proposta não volta a aparecer no Cadastro até Marllon concluir um caminho.

## Resultado esperado

Marllon abre o link `COT-20260519-124532888-262` e cai na **Escolha de Vistoria**, podendo escolher:
- Autovistoria do zero (2 fotos + vídeo 360°)
- Agendar instalação domiciliar
- Vistoria na base

Quando ele concluir qualquer caminho, a proposta entra naturalmente na fila do Cadastro.

## Verificação pós-migração

```sql
SELECT status_contratacao FROM cotacoes WHERE id='b50180dc-e4f0-420f-8f08-a07175ef0212';
-- esperado: contrato_assinado
SELECT status FROM associados WHERE id='d7b2d4c7-bf15-4c94-838f-0c6bb9db1463';
-- esperado: em_analise
SELECT status FROM veiculos WHERE id='7719dcaa-d842-483a-b8d4-b92e30880c70';
-- esperado: em_analise
```
