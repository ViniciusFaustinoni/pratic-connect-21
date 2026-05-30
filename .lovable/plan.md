
## Diagnóstico

### Por que o LUIZ FERNANDO ainda não aprova

Confirmado no banco:

- `contrato.documentos_aprovados_em` ✅ preenchido (sub-etapa 1 ok)
- `contrato.cadastro_aprovado = false` (sub-etapa 2 pendente)
- `cotacoes.status_contratacao = aguardando_aprovacao_cadastro` ✅
- `vistorias`: `modalidade = autovistoria`, `video_360_url` ✅ preenchido
- `vistoria_fotos`: **1 foto**
- `cotacoes_vistoria_fotos` (legado): **3 fotos** (chassi, motor, selfie da autovistoria original)

**Bug**: o hook `usePropostasPendentes` (modal single e listagem) só busca `cotacoes_vistoria_fotos` como **fallback** quando `vistoria_fotos.length === 0`. Como LUIZ tem 1 foto em `vistoria_fotos`, o hook ignora as 3 fotos legadas → `proposta.vistoria.fotos.length = 1`.

Cascata do bug:

```
fotos.length = 1
 ↓
autovistoriaCompleta = (1 >= 2 && temVideo) || 1 >= 31  →  false
 ↓
isAutovistoriaEnxutaAcimaFipe = false
 ↓
cadastroAvaliaFotos = false   E   aprovarApenasDocumentos = false
 ↓
tipoEtapaAnaliseSingle = 'agendamento_confirmado'  (existe instalação agendada paralela)
 ↓
aguardandoExecucao = true  E  aprovarApenasDocumentos = false
 ↓
podeAprovar = false  →  botão "Aprovar Proposta / Liberar R&F" desaparece silenciosamente
```

É **exatamente o mesmo padrão** do caso Marllon/KRF8B74 e do `video_360_url` desincronizado: dado fragmentado entre `vistoria_fotos` (nova) e `cotacoes_vistoria_fotos` (legado), e o consumer não faz união.

### Por que apareceram 7 pendências no Cadastro

Consultei a tabela: existem **7 contratos** com `status='assinado'` e `cadastro_aprovado=false`. Os outros 6 não são novos — são casos antigos (de 22/04 a 29/05) que **já estavam pendentes**. A fila estava mostrando 6 antes, agora mostra 7 (LUIZ voltou pra fila após o hotfix anterior). Nada foi criado a mais.

Vou anotar isso no fechamento para o usuário não ficar com a dúvida. Não há ação corretiva sobre os outros 6 — eles devem seguir o fluxo natural de análise.

---

## Plano (3 itens, escopo cirúrgico)

### 1. Hotfix dos dados do LUIZ FERNANDO

Materializar as 3 fotos legadas em `vistoria_fotos` (assim qualquer leitor — UI nova, edge de aprovação, futura migration — vê o set completo, e o LUIZ destrava agora). Não rebobina nada do contrato.

```sql
-- migration
INSERT INTO vistoria_fotos (vistoria_id, tipo, arquivo_url, created_at)
SELECT
  '8a617730-9cce-4ca9-a1b0-c69f6b529801'::uuid,
  cvf.tipo,
  cvf.arquivo_url,
  cvf.created_at
FROM cotacoes_vistoria_fotos cvf
WHERE cvf.cotacao_id = 'fe7e833c-5d0b-49ab-9307-91346bc47758'
  AND NOT EXISTS (
    SELECT 1 FROM vistoria_fotos vf
    WHERE vf.vistoria_id = '8a617730-9cce-4ca9-a1b0-c69f6b529801'
      AND vf.arquivo_url = cvf.arquivo_url
  );

-- audit log [HOTFIX]
```

Resultado esperado: `vistoria_fotos.count = 4`, `autovistoriaCompleta=true`, `tipoEtapaAnalise='vistoria_concluida'`, `cadastroAvaliaFotos=true`, `liberaCoberturaRF=true`, botão **"Liberar Cobertura Roubo e Furto"** aparece.

### 2. Correção canônica do merge no hook (raiz)

Em `src/hooks/usePropostasPendentes.ts` (duas ocorrências: listagem ~linha 540 e single ~linha 1123): quando `vistoria.modalidade === 'autovistoria'` e `contrato.cotacao_id` existe, **sempre** unir `vistoria_fotos` + `cotacoes_vistoria_fotos` (dedup por `arquivo_url`), em vez de tratar legado como fallback condicional.

Isso elimina toda uma classe de casos futuros idênticos ao LUIZ — qualquer autovistoria que tenha 1 foto materializada na nova tabela e o resto preso no legado deixa de quebrar o stepper.

Não altera comportamento de vistoria presencial (continua só `vistoria_fotos`).

### 3. Validação manual logado como admin

Após (1) e (2), entrar como `admin@teste.com / 123456789123456789`, abrir o caso do LUIZ em `/cadastro/proposta-pendentes`, confirmar:

- Stepper mostra 3 etapas (Docs / Fotos / Liberar R&F)
- Etapa 1 ✅
- Etapa 2 mostra as 4 fotos + vídeo, marca "Fotos revisadas"
- Botão verde **"Liberar Cobertura Roubo e Furto"** ativo
- Clique invoca `aprovar-proposta`, contrato vai pra `cadastro_aprovado=true`, `cotacao.status_contratacao` avança

Se o clique funcionar end-to-end, encerro.

---

## Fora de escopo (registrado pra próxima rodada)

- Trigger de sync `cotacoes_vistoria_fotos → vistoria_fotos` (raiz do problema de dados fragmentados). Já estava na lista de pendências da rodada anterior. **Não entra agora**, mas vou reforçar o registro.
- Os outros 6 contratos pendentes — fluxo natural do analista, sem ação minha.

---

## Resposta ao usuário no fechamento

Vou deixar claro: (a) destravei seu caso; (b) os 7 que apareceram não foram criados agora — 6 já estavam pendentes há semanas, são casos legítimos pro analista trabalhar; (c) o merge corrigido evita o mesmo bug em casos futuros.
