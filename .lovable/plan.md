## Contexto

Hoje o `sga-hinova-sync` envia ao Hinova as **fotos do veículo** via `POST /veiculo/foto/cadastrar`, mas a coleta de documentos está limitada e os documentos do **associado** (CNH, CRLV, comprovante de residência, RG, selfie, etc.) não estão chegando como fotos no SGA.

Verificações:
- `hinova_mapeamentos` (tipo `tipo_foto`) já tem códigos para: `cnh=1`, `crlv=2`, `comprovante_residencia=3`, `rg=11`, `cpf=12`, além das fotos de veículo. Ou seja, a Hinova aceita esses tipos no mesmo endpoint `/veiculo/foto/cadastrar` (anexa ao veículo).
- A maior parte dos docs do associado vive em `contratos_documentos` (CNH 556, CRLV 543, comprovante 574, RG 51), não em `documentos`. O sync já consulta `contratos_documentos` filtrando por `cotacao_id`, então os tipos já estão alcançáveis — o problema é só o mapeamento/aliases e a inclusão de selfie/documento de identidade que não estão na tabela.
- `buildFotosPayload` (em `_shared/hinova-payloads.ts`) descarta qualquer doc cujo tipo não resolva código. Hoje aliases cobrem só fotos do veículo. Precisamos adicionar aliases para documentos do associado e garantir que tipos diretos (`cnh`, `crlv`, `comprovante_residencia`, `rg`) já passem direto (já passam — só conferir).
- `selfie_documento` e variações ainda não têm código no mapeamento; vão ficar em `descartadasSemTipo` com log claro (sem quebrar envio).

## Mudanças

### 1) `supabase/functions/_shared/hinova-payloads.ts`

Expandir `aliasTipo` em `buildFotosPayload` para incluir aliases de documentos de associado:

```
'foto_cnh' → 'cnh'
'cnh_frente' / 'cnh_verso' / 'cnh_aberta' → 'cnh'
'foto_crlv' / 'crlv_frente' / 'crlv_verso' → 'crlv'
'comprovante' / 'comp_residencia' / 'comprovante_endereco' → 'comprovante_residencia'
'foto_rg' / 'rg_frente' / 'rg_verso' → 'rg'
'foto_cpf' → 'cpf'
'selfie' / 'selfie_documento' / 'selfie_com_documento' → 'cnh' (fallback documental — confirmado abaixo)
```

Para `selfie_documento`: como a Hinova não tem código próprio, manter como descarte com log explícito `'sem_mapeamento_hinova_para_selfie'` (não inventar mapeamento). Se o usuário quiser enviar, criamos um mapeamento via UI.

### 2) `supabase/functions/sga-hinova-sync/index.ts` (linhas 746-765)

Ampliar a coleta de documentos do associado para garantir cobertura:

a) Em `documentos` (já vem por `or` de `associado_id`/`veiculo_id`) — manter, mas remover o filtro `status in ('aprovado','em_analise')` apenas para tipos de documento de associado (CNH/CRLV/comprovante/RG), porque associados do fluxo público frequentemente têm doc em `pendente` no momento do primeiro envio. Manter o filtro para fotos de veículo (que precisam estar aprovadas/em análise).

   Estratégia mais simples e segura: trocar para `.in('status', ['aprovado','em_analise','pendente'])` e logar `status` no `enviar_fotos_descarte` para auditoria. Documentos `reprovado`/`expirado` continuam excluídos.

b) Em `contratos_documentos` — mesma ampliação de status (`aprovado`, `em_analise`, `pendente`).

c) Adicionar uma terceira fonte: tabela `associados` com colunas de selfie/foto pessoal (se existir `foto_url`/`selfie_url`/`avatar_url`). **Validar via consulta antes de implementar** — se não existir, ignorar este item.

### 3) Rastreabilidade

- No log `enviar_fotos_descarte` incluir, por documento descartado, `{id, tipo, motivo}` (já tem `descartadasSemTipo`; adicionar contagem por tipo).
- No log `enviar_fotos` incluir breakdown `por_tipo: { cnh: N, crlv: N, ... }` para facilitar conferência no modal de detalhes da Fila SGA.

### 4) Política / Memória

Atualizar `mem://features/integrations/sga-hinova-sync-and-pre-check-v3` adicionando regra:
> "Documentos do associado (CNH, CRLV, comprovante de residência, RG) também são enviados ao Hinova via `POST /veiculo/foto/cadastrar` anexados ao `codigo_veiculo`, junto com as fotos do veículo. Status aceitos: aprovado, em_analise, pendente. Selfie sem código Hinova é registrada como descarte explícito."

## Arquivos afetados

- `supabase/functions/_shared/hinova-payloads.ts` — aliases ampliados
- `supabase/functions/sga-hinova-sync/index.ts` — coleta ampliada + logs
- `mem://features/integrations/sga-hinova-sync-and-pre-check-v3` — política

## Validação

1. Cotação ativada com CNH+CRLV+comprovante em `contratos_documentos` (status `aprovado`): SGA recebe veículo + 3 fotos de documento + fotos do veículo. Modal de detalhes mostra breakdown por tipo.
2. Cotação ativada com docs ainda `pendente`: também enviados (apenas `reprovado`/`expirado` ficam fora).
3. Doc com tipo desconhecido ou sem mapeamento: aparece em `enviar_fotos_descarte` com motivo claro, sem bloquear o envio dos demais.
4. Re-execução (force_resync_media=true): re-envia todos os documentos.

## Notas

- Não altera o endpoint da Hinova nem cria nova função — usa o mesmo `cadastrarFotosVeiculoHinova` em lotes de 50 já existente.
- Não impacta a regra de "primeiro envio sempre pendente" implementada anteriormente.
- Se o usuário tiver criado um mapeamento para `selfie_documento` na UI de mapeamentos, ele passa a fluir automaticamente sem mudança de código.