## 1) Correção pontual — destravar o instalador agora

**Caso:** chassi `9C2JK3400VR006840` (HONDA ELITE 125, moto, FIPE R$ 15.779), instalação `5b5bece7-6c6e-4a79-bd75-0d59ffd75647`, rastreador `357789644844604` (NT20, Softruck), estoque.

**Migration (data fix idempotente, sem schema):**

```sql
-- 1.1 Vincular rastreador ao veículo + status 'instalado'
UPDATE public.rastreadores
   SET veiculo_id = 'eafcc3ac-723a-4081-8408-8273023c5266',
       status     = 'instalado',
       updated_at = now()
 WHERE id = '23f08cf5-54d9-4eba-b7d9-33299a518e49'
   AND (veiculo_id IS NULL OR veiculo_id = 'eafcc3ac-723a-4081-8408-8273023c5266');

-- 1.2 Apontar rastreador na instalação atual
UPDATE public.instalacoes
   SET rastreador_id = '23f08cf5-54d9-4eba-b7d9-33299a518e49',
       updated_at    = now()
 WHERE id = '5b5bece7-6c6e-4a79-bd75-0d59ffd75647'
   AND rastreador_id IS NULL;

-- 1.3 Movimentação de estoque (auditoria)
INSERT INTO public.estoque_movimentacoes
       (tipo, quantidade, status_anterior, status_novo, rastreador_id, observacoes)
SELECT 'alteracao_status', 1, 'estoque', 'instalado',
       '23f08cf5-54d9-4eba-b7d9-33299a518e49',
       'Vínculo manual — HONDA ELITE 125 chassi 9C2JK3400VR006840 (saneamento)'
 WHERE NOT EXISTS (
   SELECT 1 FROM public.estoque_movimentacoes
    WHERE rastreador_id = '23f08cf5-54d9-4eba-b7d9-33299a518e49'
      AND status_novo = 'instalado'
      AND created_at > now() - interval '1 hour'
 );
```

**Pós-fix:** instalador atualiza o link, vê IMEI já preenchido (ou digita o mesmo `357789644844604`), marca decisão "Aprovado" e clica **Concluir Instalação** — o guard `trg_guard_instalacao_concluida_exige_rastreador` passa, fluxo segue normal para Aprovação de Associados.

---

## 2) Correção de raiz — UI

**Arquivo único:** `src/pages/instalador/InstaladorChecklist.tsx`

**Diagnóstico:** o componente usa `detectarTipoVeiculo(veiculoData?.tipo_veiculo, modelo, marca)` (síncrono, deprecated). A coluna `veiculos.tipo_veiculo` não existe, então só sobra heurística por marca/modelo. HONDA não está em `MOTO_BRANDS` (ambígua) e o keyword `elite` está na lista — então tecnicamente detectaria moto. Mas há um caminho onde escapa (snapshot ausente + variação de modelo). A fonte canônica é a RPC `fn_detectar_tipo_veiculo` exposta pelo hook `useDetectarTipoVeiculo` — mesma que o cotador usa.

**Mudança:**

1. Substituir o `useMemo` da linha 218 por `useDetectarTipoVeiculo({ marca, modelo, tipo_veiculo, snapshot })` (assíncrono, com fallback síncrono para o primeiro render).
2. Enquanto `isLoading=true`, esconder o card "Rastreador dispensado" e o card "Local de Instalação" (sem flicker que confunda o instalador).
3. Log `[InstaladorChecklist] tipoVeiculo final: <moto|automovel> (fonte: rpc|fallback)` para auditoria.

Nada muda na edge `concluir-instalacao-prestador` nem no guard DB — o fix de UI elimina o falso "dispensado" para motos FIPE ≥ R$ 9k, e o guard continua sendo a rede de segurança.

### Arquivos tocados

- `supabase/migrations/<timestamp>_vincular_rastreador_NT20_elite125.sql` (item 1)
- `src/pages/instalador/InstaladorChecklist.tsx` (item 2)

### Fora de escopo

- Backfill histórico de outras instalações onde isso possa ter acontecido (não pedido).
- Mexer em edges, contrato ou Monitoramento.
- Alterar `precisaRastreador` / `useConfigRastreador` (regras de FIPE estão corretas).