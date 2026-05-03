import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, AlertTriangle, MinusCircle } from 'lucide-react';
import type { DadosExtraidos } from './OrcamentoPDFImport';

interface SistemaCtx {
  placa?: string | null;
  chassi?: string | null;
  marca?: string | null;
  modelo?: string | null;
  ano?: string | number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  dados: DadosExtraidos | null;
  sistema: SistemaCtx;
}

const norm = (v: any) => String(v ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

function CmpRow({ label, pdf, sys }: { label: string; pdf?: string | null; sys?: string | null }) {
  const hasPdf = !!pdf;
  const hasSys = !!sys;
  const match = hasPdf && hasSys && norm(pdf) === norm(sys);
  const Icon = !hasPdf ? MinusCircle : match ? CheckCircle2 : AlertTriangle;
  const color = !hasPdf ? 'text-muted-foreground' : match ? 'text-green-600' : 'text-amber-600';
  const status = !hasPdf ? 'sem dado' : match ? 'confere' : hasSys ? 'divergente' : 'só no PDF';

  return (
    <div className="grid grid-cols-12 items-center gap-2 py-1.5 border-b last:border-0 text-xs">
      <div className="col-span-3 font-medium text-muted-foreground">{label}</div>
      <div className="col-span-4 truncate" title={pdf ?? ''}>{pdf || <span className="text-muted-foreground italic">—</span>}</div>
      <div className="col-span-4 truncate" title={sys ?? ''}>{sys || <span className="text-muted-foreground italic">—</span>}</div>
      <div className={`col-span-1 flex justify-end ${color}`} title={status}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

export function OrcamentoReviewModal({ open, onClose, onConfirm, dados, sistema }: Props) {
  if (!dados) return null;
  const h = dados.header || {};
  const areas = dados.impact_areas || [];
  const totalPecas = dados.pecas?.length || 0;
  const totalServicos = dados.servicos?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Revisar dados do orçamento</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-4">
            <section>
              <h3 className="text-sm font-semibold mb-2">Cabeçalho do PDF × Sistema</h3>
              <div className="rounded-lg border p-3">
                <div className="grid grid-cols-12 gap-2 text-[10px] uppercase text-muted-foreground pb-1 border-b">
                  <div className="col-span-3">Campo</div>
                  <div className="col-span-4">PDF</div>
                  <div className="col-span-4">Sistema</div>
                  <div className="col-span-1 text-right">OK</div>
                </div>
                <CmpRow label="Placa" pdf={h.placa} sys={sistema.placa} />
                <CmpRow label="Chassi" pdf={h.chassi} sys={sistema.chassi} />
                <CmpRow label="Marca" pdf={h.marca} sys={sistema.marca} />
                <CmpRow label="Modelo" pdf={h.modelo} sys={sistema.modelo} />
                <CmpRow label="Ano" pdf={h.ano} sys={sistema.ano ? String(sistema.ano) : null} />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">Oficina e orçamento</h3>
              <div className="rounded-lg border p-3 text-xs space-y-1">
                <div><span className="text-muted-foreground">Oficina:</span> {h.oficina_nome || '—'} {h.oficina_cnpj ? `(${h.oficina_cnpj})` : ''}</div>
                <div><span className="text-muted-foreground">Local:</span> {h.oficina_cidade_uf || '—'}</div>
                <div><span className="text-muted-foreground">Nº orçamento:</span> {h.numero_orcamento || '—'} • <span className="text-muted-foreground">Emissão:</span> {h.data_emissao || '—'}</div>
                {h.valor_fipe ? (
                  <div><span className="text-muted-foreground">FIPE no orçamento:</span> R$ {Number(h.valor_fipe).toFixed(2)}</div>
                ) : null}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">Áreas de impacto</h3>
              {areas.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma área de impacto identificada no PDF.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {areas.map((a, i) => (
                    <Badge key={i} variant="secondary" className="text-[11px]">
                      {a.nome} <span className="ml-1 opacity-70">({a.qtd_pecas})</span>
                    </Badge>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">Resumo</h3>
              <div className="rounded-lg border p-3 grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-muted-foreground">Peças</div><div className="font-semibold">{totalPecas}</div></div>
                <div><div className="text-muted-foreground">Serviços avulsos</div><div className="font-semibold">{totalServicos}</div></div>
                <div><div className="text-muted-foreground">Total geral</div><div className="font-semibold">R$ {Number(dados.resumo?.total_geral ?? 0).toFixed(2)}</div></div>
              </div>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onConfirm}>Confirmar e importar itens</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
