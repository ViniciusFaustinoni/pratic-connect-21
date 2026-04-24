import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Upload, Loader2, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';

interface ImportarLinhasModalProps {
  open: boolean;
  onClose: () => void;
}

interface ParsedRow {
  linha: string;
  plano: string;
  tipoItem: string;
  nomeItem: string;
  codigoItem: string;
  descricaoItem: string;
  valor: number;
  categoria: string;
  carenciaAtiva: boolean;
  carenciaTipo: string;
  carenciaDias: number;
  carenciaMultiplicador: number | null;
  franquiaPerc: number | null;
  franquiaValor: number | null;
  percCobertura: number | null;
  valorLimite: number | null;
}

interface ImportResult {
  linhas: number;
  planos: number;
  coberturas: number;
  beneficios: number;
}

const TEMPLATE_COLUMNS = [
  'Linha', 'Plano', 'Tipo Item', 'Nome Item', 'Código Item', 'Descrição Item',
  'Valor (R$)', 'Categoria', 'Carência Ativa', 'Carência Tipo', 'Carência Dias',
  'Carência Multiplicador', 'Franquia %', 'Franquia Valor', '% Cobertura', 'Valor Limite',
];

const EXAMPLE_ROWS = [
  ['Select', 'Select Básico', 'cobertura', 'Roubo e Furto', 'COB-RF-001', 'Cobertura contra roubo e furto', 89.90, '', 'sim', 'liberacao', 30, '', '', '', 100, ''],
  ['Select', 'Select Básico', 'beneficio', 'Assistência 24h', 'BEN-A24-001', 'Guincho e socorro', 29.90, 'assistencia', 'não', '', '', '', '', '', '', ''],
  ['Select', 'Select Premium', 'cobertura', 'Roubo e Furto', 'COB-RF-001', '', 89.90, '', 'sim', 'multiplicadora_cota', 60, 2.0, 5, 500, 100, 50000],
  ['Premium', 'Premium Full', 'beneficio', 'Carro Reserva', 'BEN-CR-001', '7 dias', 49.90, 'extra', 'sim', 'liberacao', 90, '', '', '', '', ''],
];

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const data = [TEMPLATE_COLUMNS, ...EXAMPLE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Column widths
  ws['!cols'] = TEMPLATE_COLUMNS.map((h) => ({ wch: Math.max(h.length + 2, 14) }));

  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'template_importacao_linhas_planos.xlsx');
}

function parseSheet(wb: XLSX.WorkBook): ParsedRow[] {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (raw.length < 2) throw new Error('Planilha vazia ou sem dados');

  const rows: ParsedRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || !r[0] || !r[1] || !r[2] || !r[3] || !r[4]) continue;

    const tipo = String(r[2]).trim().toLowerCase();
    if (tipo !== 'cobertura' && tipo !== 'beneficio') continue;

    rows.push({
      linha: String(r[0]).trim(),
      plano: String(r[1]).trim(),
      tipoItem: tipo,
      nomeItem: String(r[3]).trim(),
      codigoItem: String(r[4]).trim(),
      descricaoItem: r[5] ? String(r[5]).trim() : '',
      valor: Number(r[6]) || 0,
      categoria: r[7] ? String(r[7]).trim().toLowerCase() : 'geral',
      carenciaAtiva: r[8] ? String(r[8]).trim().toLowerCase() === 'sim' : false,
      carenciaTipo: r[9] ? String(r[9]).trim().toLowerCase() : '',
      carenciaDias: Number(r[10]) || 0,
      carenciaMultiplicador: r[11] ? Number(r[11]) : null,
      franquiaPerc: r[12] ? Number(r[12]) : null,
      franquiaValor: r[13] ? Number(r[13]) : null,
      percCobertura: r[14] ? Number(r[14]) : null,
      valorLimite: r[15] ? Number(r[15]) : null,
    });
  }
  return rows;
}

export function ImportarLinhasModal({ open, onClose }: ImportarLinhasModalProps) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const queryClient = useQueryClient();

  const onDrop = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const rows = parseSheet(wb);
        if (rows.length === 0) {
          toast.error('Nenhuma linha válida encontrada na planilha');
          return;
        }
        setPreview(rows);
        setResult(null);
      } catch (err: any) {
        toast.error(err.message || 'Erro ao ler planilha');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] },
    maxFiles: 1,
  });

  const processImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const counts: ImportResult = { linhas: 0, planos: 0, coberturas: 0, beneficios: 0 };

      // Group by line → plan → items
      const lineMap = new Map<string, Map<string, ParsedRow[]>>();
      for (const row of preview) {
        if (!lineMap.has(row.linha)) lineMap.set(row.linha, new Map());
        const planMap = lineMap.get(row.linha)!;
        if (!planMap.has(row.plano)) planMap.set(row.plano, []);
        planMap.get(row.plano)!.push(row);
      }

      for (const [linhaName, planMap] of lineMap) {
        // Upsert product line
        const slug = linhaName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const { data: existingLine } = await supabase
          .from('product_lines').select('id').eq('slug', slug).maybeSingle();

        let lineId: string;
        if (existingLine) {
          lineId = existingLine.id;
        } else {
          const { data: newLine, error } = await supabase
            .from('product_lines').insert({ name: linhaName, slug, display_order: 99 }).select('id').single();
          if (error) throw error;
          lineId = newLine.id;
          counts.linhas++;
        }

        for (const [planoName, items] of planMap) {
          // Create plan
          const codigo = planoName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
          const { data: newPlano, error: pe } = await supabase
            .from('planos').insert({
              nome: planoName,
              codigo,
              slug: codigo,
              product_line_id: lineId,
              ativo: true,
              visivel_cotacao: true,
              visivel_gestao: true,
              valor_adesao: 0,
              ordem: 99,
            }).select('id').single();
          if (pe) throw pe;
          counts.planos++;

          for (const item of items) {
            if (item.tipoItem === 'cobertura') {
              // Upsert cobertura
              const { data: existing } = await supabase
                .from('coberturas').select('id').eq('codigo', item.codigoItem).maybeSingle();

              let cobId: string;
              if (existing) {
                cobId = existing.id;
              } else {
                const { data: newCob, error } = await supabase
                  .from('coberturas').insert({
                    nome: item.nomeItem,
                    codigo: item.codigoItem,
                    descricao: item.descricaoItem || null,
                    tipo: 'cobertura',
                    valor: item.valor,
                    ativo: true,
                    carencia_dias: item.carenciaAtiva ? item.carenciaDias : null,
                    carencia_ativa: item.carenciaAtiva,
                    carencia_tipo: item.carenciaAtiva ? item.carenciaTipo : null,
                    carencia_multiplicador: item.carenciaMultiplicador,
                  }).select('id').single();
                if (error) throw error;
                cobId = newCob.id;
                counts.coberturas++;
              }

              // Link to plan
              await supabase.from('planos_coberturas').insert({
                plano_id: newPlano.id,
                cobertura_id: cobId,
                franquia_percentual: item.franquiaPerc,
                franquia_valor: item.franquiaValor,
                percentual_cobertura: item.percCobertura,
                valor_limite: item.valorLimite,
              });

            } else {
              // Upsert benefit
              const benefitSlug = item.codigoItem.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              const { data: existing } = await supabase
                .from('benefits').select('id').eq('slug', benefitSlug).maybeSingle();

              let benId: string;
              if (existing) {
                benId = existing.id;
              } else {
                const validCategories = ['assistencia', 'extra', 'geral', 'cobertura'];
                const cat = validCategories.includes(item.categoria) ? item.categoria : 'geral';

                const { data: newBen, error } = await supabase
                  .from('benefits').insert({
                    name: item.nomeItem,
                    slug: benefitSlug,
                    description: item.descricaoItem || null,
                    category: cat,
                    preco_sugerido: item.valor,
                    is_active: true,
                    carencia_dias: item.carenciaAtiva ? item.carenciaDias : null,
                    carencia_ativa: item.carenciaAtiva,
                    carencia_tipo: item.carenciaAtiva ? item.carenciaTipo : null,
                    carencia_multiplicador: item.carenciaMultiplicador,
                  }).select('id').single();
                if (error) throw error;
                benId = newBen.id;
                counts.beneficios++;
              }

              await supabase.from('planos_beneficios').insert({
                plano_id: newPlano.id,
                benefit_id: benId,
                beneficio: item.nomeItem,
              });
            }
          }
        }
      }

      setResult(counts);
      queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
      toast.success('Importação concluída!');
    } catch (err: any) {
      toast.error(`Erro na importação: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setPreview(null);
    setResult(null);
    onClose();
  };

  // Preview summary
  const previewSummary = preview ? (() => {
    const linhas = new Set(preview.map(r => r.linha)).size;
    const planos = new Set(preview.map(r => `${r.linha}||${r.plano}`)).size;
    const cobs = preview.filter(r => r.tipoItem === 'cobertura').length;
    const bens = preview.filter(r => r.tipoItem === 'beneficio').length;
    return { linhas, planos, cobs, bens };
  })() : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Linhas e Planos</DialogTitle>
          <DialogDescription>Importe linhas completas com planos, coberturas e benefícios via planilha</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download template */}
          <Button variant="outline" className="w-full" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />Baixar Template XLSX
          </Button>

          {/* Result */}
          {result ? (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">Importação concluída!</span>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>{result.linhas} linha(s) criada(s)</li>
                <li>{result.planos} plano(s) criado(s)</li>
                <li>{result.coberturas} cobertura(s) criada(s)</li>
                <li>{result.beneficios} benefício(s) criado(s)</li>
              </ul>
              <Button className="w-full mt-2" onClick={handleClose}>Fechar</Button>
            </div>
          ) : preview ? (
            /* Preview */
            <div className="space-y-3">
              <div className="border rounded-lg p-3 bg-muted/30">
                <p className="text-sm font-medium mb-2">Resumo da planilha:</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <span>{previewSummary?.linhas} linha(s)</span>
                  <span>{previewSummary?.planos} plano(s)</span>
                  <span>{previewSummary?.cobs} cobertura(s)</span>
                  <span>{previewSummary?.bens} benefício(s)</span>
                </div>
              </div>

              <div className="max-h-48 overflow-auto border rounded text-xs">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left">Linha</th>
                      <th className="px-2 py-1 text-left">Plano</th>
                      <th className="px-2 py-1 text-left">Tipo</th>
                      <th className="px-2 py-1 text-left">Item</th>
                      <th className="px-2 py-1 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{r.linha}</td>
                        <td className="px-2 py-1">{r.plano}</td>
                        <td className="px-2 py-1">{r.tipoItem}</td>
                        <td className="px-2 py-1">{r.nomeItem}</td>
                        <td className="px-2 py-1 text-right">R$ {r.valor.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setPreview(null)}>Voltar</Button>
                <Button className="flex-1" onClick={processImport} disabled={importing}>
                  {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  Importar
                </Button>
              </div>
            </div>
          ) : (
            /* Dropzone */
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}`}
            >
              <input {...getInputProps()} />
              <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isDragActive ? 'Solte o arquivo aqui...' : 'Arraste uma planilha XLSX ou clique para selecionar'}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
