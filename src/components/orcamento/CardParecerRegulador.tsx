import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Wrench, Clock, AlertTriangle, Image, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useParecerTecnico,
  useParecerTecnicoItens,
  useParecerTecnicoFotos,
} from '@/hooks/useParecerTecnico';

const GRAVIDADE_BADGE: Record<string, { label: string; className: string }> = {
  leve: { label: 'Leve', className: 'bg-green-100 text-green-800 border-green-200' },
  moderado: { label: 'Moderado', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  grave: { label: 'Grave', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  possivel_perda_total: { label: 'Possível Perda Total', className: 'bg-red-100 text-red-800 border-red-200' },
};

const PRIORIDADE_BADGE: Record<string, { label: string; className: string }> = {
  essencial: { label: 'Essencial', className: 'bg-red-100 text-red-700' },
  necessario: { label: 'Necessário', className: 'bg-blue-100 text-blue-700' },
  opcional: { label: 'Opcional', className: 'bg-gray-100 text-gray-700' },
};

const ORIGEM_LABELS: Record<string, string> = {
  original: 'Original',
  seminova: 'Seminova',
  paralela: 'Paralela',
  qualquer: 'Qualquer',
};

const PRAZO_LABELS: Record<string, string> = {
  ate_5_dias: 'Até 5 dias úteis',
  '5_a_15': '5 a 15 dias úteis',
  '15_a_30': '15 a 30 dias úteis',
  '30_a_60': '30 a 60 dias úteis',
  mais_60: 'Mais de 60 dias úteis',
};

const RECOMENDACAO_LABELS: Record<string, { label: string; className: string }> = {
  seguir_reparo: { label: 'Seguir com reparo', className: 'bg-green-100 text-green-700' },
  segunda_avaliacao: { label: 'Segunda avaliação', className: 'bg-yellow-100 text-yellow-700' },
  avaliar_perda_total: { label: 'Avaliar Perda Total', className: 'bg-red-100 text-red-700' },
  pericia_tecnica: { label: 'Perícia técnica', className: 'bg-orange-100 text-orange-700' },
};

interface Props {
  sinistroId: string;
  valorFipe?: number;
}

export function CardParecerRegulador({ sinistroId, valorFipe }: Props) {
  const { data: parecer, isLoading } = useParecerTecnico(sinistroId);
  const { data: itens = [] } = useParecerTecnicoItens(parecer?.id);
  const { data: fotos = [] } = useParecerTecnicoFotos(parecer?.id);
  const [fotoAberta, setFotoAberta] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  if (isLoading || !parecer) return null;

  const pecas = itens.filter(i => i.tipo === 'peca');
  const servicos = itens.filter(i => i.tipo === 'servico');
  const totalPecas = pecas.reduce((s, i) => s + (i.valor_estimado * i.quantidade), 0);
  const totalServicos = servicos.reduce((s, i) => s + (i.valor_estimado * i.quantidade), 0);
  const totalGeral = totalPecas + totalServicos;
  const pctFipe = valorFipe && valorFipe > 0 ? (totalGeral / valorFipe) * 100 : 0;
  const alertaFipe = pctFipe > 75;

  const gravidadeBadge = GRAVIDADE_BADGE[parecer.gravidade] || GRAVIDADE_BADGE.moderado;

  return (
    <>
      <Card className="border-teal-200">
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4 text-teal-600" />
              Parecer Técnico do Regulador
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={gravidadeBadge.className}>
                {gravidadeBadge.label}
              </Badge>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span>{parecer.regulador_nome}</span>
            <span>•</span>
            <span>{format(new Date(parecer.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="space-y-4 text-sm">
            {/* Descrição técnica */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Descrição Técnica</p>
              <p className="bg-muted p-2 rounded text-xs">{parecer.descricao_tecnica}</p>
            </div>

            {/* Fotos técnicas */}
            {fotos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Image className="h-3 w-3" /> Fotos Técnicas ({fotos.length})
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {fotos.map(foto => (
                    <div
                      key={foto.id}
                      className="aspect-square rounded border overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all"
                      onClick={() => setFotoAberta(foto.arquivo_url)}
                    >
                      <img src={foto.arquivo_url} alt={foto.descricao || 'Foto técnica'} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Itens estimados */}
            {itens.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Itens Estimados</p>

                {pecas.length > 0 && (
                  <>
                    <p className="text-xs font-medium mb-1">🔧 Peças ({pecas.length})</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Descrição</TableHead>
                          <TableHead className="text-xs">Origem</TableHead>
                          <TableHead className="text-xs text-right">Qtd</TableHead>
                          <TableHead className="text-xs text-right">Estimativa</TableHead>
                          <TableHead className="text-xs">Prioridade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pecas.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs">
                              {item.descricao}
                              {item.observacao && <p className="text-[10px] text-muted-foreground mt-0.5">{item.observacao}</p>}
                            </TableCell>
                            <TableCell className="text-xs">{item.origem_sugerida ? ORIGEM_LABELS[item.origem_sugerida] || item.origem_sugerida : '—'}</TableCell>
                            <TableCell className="text-xs text-right">{item.quantidade}</TableCell>
                            <TableCell className="text-xs text-right">R$ {(item.valor_estimado * item.quantidade).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${PRIORIDADE_BADGE[item.prioridade]?.className || ''}`}>
                                {PRIORIDADE_BADGE[item.prioridade]?.label || item.prioridade}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-medium">
                          <TableCell colSpan={3} className="text-right text-xs">Subtotal Peças:</TableCell>
                          <TableCell className="text-right text-xs">R$ {totalPecas.toFixed(2)}</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </>
                )}

                {servicos.length > 0 && (
                  <>
                    <p className="text-xs font-medium mb-1 mt-3">🛠️ Serviços ({servicos.length})</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Descrição</TableHead>
                          <TableHead className="text-xs text-right">Qtd</TableHead>
                          <TableHead className="text-xs text-right">Estimativa</TableHead>
                          <TableHead className="text-xs">Prioridade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {servicos.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs">
                              {item.descricao}
                              {item.observacao && <p className="text-[10px] text-muted-foreground mt-0.5">{item.observacao}</p>}
                            </TableCell>
                            <TableCell className="text-xs text-right">{item.quantidade}</TableCell>
                            <TableCell className="text-xs text-right">R$ {(item.valor_estimado * item.quantidade).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${PRIORIDADE_BADGE[item.prioridade]?.className || ''}`}>
                                {PRIORIDADE_BADGE[item.prioridade]?.label || item.prioridade}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-medium">
                          <TableCell colSpan={2} className="text-right text-xs">Subtotal Serviços:</TableCell>
                          <TableCell className="text-right text-xs">R$ {totalServicos.toFixed(2)}</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </>
                )}

                {/* Totais */}
                <div className="mt-3 rounded-lg bg-muted p-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Peças:</span>
                    <span>R$ {totalPecas.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Serviços:</span>
                    <span>R$ {totalServicos.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm">
                    <span>ESTIMATIVA TOTAL:</span>
                    <span>R$ {totalGeral.toFixed(2)}</span>
                  </div>
                  {valorFipe && valorFipe > 0 && (
                    <div className={`flex justify-between text-xs mt-1 ${alertaFipe ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                      <span>FIPE: R$ {valorFipe.toFixed(0)} — Estimativa = {pctFipe.toFixed(1)}%</span>
                      {alertaFipe && <AlertTriangle className="h-3 w-3" />}
                    </div>
                  )}
                </div>

                {alertaFipe && (
                  <div className="flex items-start gap-2 p-2 rounded bg-red-50 border border-red-200 text-red-800 text-xs mt-2">
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>⚠️ A estimativa ultrapassa 75% da FIPE. Pode configurar Perda Total.</span>
                  </div>
                )}
              </div>
            )}

            {/* Prazo */}
            {parecer.prazo_estimado && (
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs">
                  <strong>Prazo estimado:</strong> {PRAZO_LABELS[parecer.prazo_estimado] || parecer.prazo_estimado}
                </span>
                {parecer.prazo_observacao && (
                  <span className="text-xs text-muted-foreground">— {parecer.prazo_observacao}</span>
                )}
              </div>
            )}

            {/* Recomendação */}
            {parecer.recomendacao && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">Recomendação:</span>
                <Badge variant="outline" className={RECOMENDACAO_LABELS[parecer.recomendacao]?.className || ''}>
                  {RECOMENDACAO_LABELS[parecer.recomendacao]?.label || parecer.recomendacao}
                </Badge>
              </div>
            )}

            {/* Observações */}
            {parecer.observacoes_gerais && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
                <p className="bg-muted p-2 rounded text-xs">{parecer.observacoes_gerais}</p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Lightbox */}
      <Dialog open={!!fotoAberta} onOpenChange={() => setFotoAberta(null)}>
        <DialogContent className="max-w-3xl p-2">
          {fotoAberta && (
            <img src={fotoAberta} alt="Foto técnica" className="w-full h-auto rounded" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
