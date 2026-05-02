## Diagnóstico — motivo raiz

A tela de Aprovação do Monitoramento chama a RPC `fn_validar_campos_ativacao` antes de ativar. Essa RPC exige `length(veiculos.chassi) >= 17`.

No caso do **MOACIR JACINTO FERREIRA** (associado `82a4284a…`, veículo `c25fd80c…`, placa `KQB6655`):

- Chassi gravado em `veiculos.chassi`: `8AP372171E608693` → **16 caracteres**
- Chassi correto (que você informou): `8AP372171E6086953` → 17 caracteres (faltou o `5` antes do último `3`).
- Não existe registro em `documentos` com OCR para esse veículo, então o chassi entrou por digitação manual em algum form e ficou.

### Por que conseguiu ser salvo sendo inválido?

A constraint `veiculos_chassi_format` no banco está marcada como **`NOT VALID`**. Isso significa:
- O Postgres só aplica a regex (`^[A-HJ-NPR-Z0-9]{17}$`) em **novos** INSERTs/UPDATEs feitos a partir do momento em que a constraint foi criada.
- Linhas pré-existentes (e qualquer caminho que tenha contornado a constraint) ficaram com chassi inválido sem rejeição.

Levantamento no banco mostra **dezenas de veículos com chassi inválido** (16 caracteres, ou contendo `O` proibido pelo padrão VIN), por exemplo: `KQB6655` (16), `OIJ7I10` (16), `TTH0I61` (16), `MTU3188` (16), `RVN4G04` (16), `LSA3223` (16), `9BGJC69ZOFB148539` (contém `O` proibido), etc.

O `VeiculoEditDialog` (UI de edição manual de veículo) já valida `^[A-HJ-NPR-Z0-9]{17}$` no Zod **e exige checkbox "permitir edição de chassi"**. Então a UI atual já permite corrigir — mas só se o usuário souber abrir esse diálogo. No fluxo de Aprovação do Monitoramento não há atalho para editar chassi: só dá erro e trava.

---

## Plano

### 1. Correção pontual (Moacir / KQB6655)

Atualizar `veiculos.chassi` de `8AP372171E608693` → `8AP372171E6086953` para o veículo `c25fd80c-6ce5-4e1f-8098-eb13117b6fb8`. Feito via migration (data fix), com log em `associados_historico`.

### 2. Correção dos demais casos — não em massa, sob demanda controlada

Não vou "advinhar" o dígito faltante de 50+ chassis (gera dado falso, pior que dado errado). Em vez disso:

- (a) Gerar um relatório SQL listando todos os veículos com chassi inválido (placa, associado, chassi atual, motivo da invalidez) e gravar em `/mnt/documents/chassis_invalidos.csv` para você revisar / acionar atendimento.
- (b) Destravar a UI para que monitoramento e cadastro consigam corrigir caso a caso sem ficar pulando entre telas.

### 3. Destravar a tela de Aprovação do Monitoramento (raiz da reclamação)

No `useAprovarInstalacaoMonitoramento` (e na UI da fila de aprovação), quando `fn_validar_campos_ativacao` devolver `chassi`/`placa`/`renavam` faltando:

- Em vez de só dar `toast.error(...)`, abrir um modal "Corrigir dados do veículo" com os campos faltantes pré-preenchidos com o valor atual.
- Validar chassi com `isValidChassi` (`src/lib/chassi.ts`) antes de gravar.
- Após gravar com sucesso, refazer automaticamente a tentativa de aprovação.

Componente novo: `src/components/monitoramento/CorrigirDadosVeiculoDialog.tsx`.
Hook ajustado: `src/hooks/useAprovacaoMonitoramento.ts` para expor `camposFaltando` no erro estruturado, em vez de só uma string.

### 4. Endurecer o banco (evitar reincidência)

- Validar a constraint existente: `ALTER TABLE veiculos VALIDATE CONSTRAINT veiculos_chassi_format` **só funciona se todas as linhas atuais estiverem válidas**. Como ainda existem inválidas, vamos:
  - (i) Manter a constraint NOT VALID por enquanto (não quebra nada).
  - (ii) Adicionar um **trigger BEFORE INSERT/UPDATE** `trg_veiculos_chassi_strict` que rejeita chassi não-NULL com formato inválido (regex VIN 17 chars, sem I/O/Q). NULL continua permitido para preenchimento posterior.
  - (iii) Depois que o relatório do passo 2 for resolvido, podemos rodar `VALIDATE CONSTRAINT` em uma migration futura. Isso fica como follow-up, não nesta entrega.

### 5. Reforçar sanitizer no front

`src/lib/sanitizers/cotacao-fields.ts::sanitizeChassi` já descarta < 17. Adicionar utilitário equivalente para uso em `VeiculoEditDialog` e em `useUpdateVeiculo` (se existir hook genérico de update de veículo) para que **toda gravação em `veiculos.chassi` passe por `sanitizeChassi` ou seja explicitamente NULL**. Isso fecha o caminho que deixou o dado entrar no banco no Moacir.

---

## Detalhes técnicos

**Arquivos novos:**
- `src/components/monitoramento/CorrigirDadosVeiculoDialog.tsx`
- `supabase/migrations/<ts>_fix_chassi_moacir_and_strict_trigger.sql`

**Arquivos editados:**
- `src/hooks/useAprovacaoMonitoramento.ts` — detectar erro estruturado da RPC, abrir dialog de correção.
- `src/pages/monitoramento/VistoriasInstalacoesMon.tsx` (ou a página/lista que usa o hook — confirmar antes de editar) — montar o dialog e re-tentar approve no `onSuccess` da correção.
- `src/components/veiculos/VeiculoEditDialog.tsx` — chamar `sanitizeChassi` antes do submit (defesa em profundidade).

**Migration SQL (resumo):**
```sql
-- 1) Fix pontual Moacir
UPDATE veiculos SET chassi='8AP372171E6086953', updated_at=now()
 WHERE id='c25fd80c-6ce5-4e1f-8098-eb13117b6fb8' AND chassi='8AP372171E608693';

INSERT INTO associados_historico(associado_id, tipo, descricao, dados_novos)
VALUES ('82a4284a-0bbf-4168-a5f0-3cf95e756e02','correcao_chassi',
        'Chassi corrigido: 8AP372171E608693 -> 8AP372171E6086953 (Lovable, suporte a aprovação monitoramento)',
        jsonb_build_object('veiculo_id','c25fd80c-6ce5-4e1f-8098-eb13117b6fb8'));

-- 2) Trigger de proteção (NULL ok, valor inválido rejeitado)
CREATE OR REPLACE FUNCTION public.fn_validar_chassi_strict()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.chassi IS NOT NULL AND NEW.chassi <> ''
     AND NEW.chassi !~ '^[A-HJ-NPR-Z0-9]{17}$' THEN
    RAISE EXCEPTION 'Chassi inválido: % (precisa ter 17 caracteres VIN, sem I/O/Q)', NEW.chassi
      USING ERRCODE = '22000';
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_veiculos_chassi_strict ON public.veiculos;
CREATE TRIGGER trg_veiculos_chassi_strict
BEFORE INSERT OR UPDATE OF chassi ON public.veiculos
FOR EACH ROW EXECUTE FUNCTION public.fn_validar_chassi_strict();
```

**Comportamento esperado depois:**
- Aprovar Moacir funciona normalmente (chassi corrigido).
- Para os outros associados na mesma situação, o monitoramento agora consegue corrigir o chassi pelo próprio modal antes de aprovar, sem ter que sair da tela.
- Tentar gravar chassi com 16 chars / com `O` é rejeitado pelo banco (HTTP 500 com mensagem clara), forçando correção no front.
- Relatório CSV em `/mnt/documents/chassis_invalidos.csv` lista os casos legados para tratamento.

## Fora do escopo (sugestões de follow-up)

- Rodar `ALTER TABLE veiculos VALIDATE CONSTRAINT veiculos_chassi_format` depois que todos os legados forem corrigidos.
- Aplicar mesma proteção (trigger) em `cotacoes.veiculo_chassi`, hoje protegido só por CHECK que pode estar NOT VALID também — verificar e seguir mesma estratégia.
