import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileSignature, User, Car, FileText, History, Upload, CheckCircle2, Loader2, ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  TIPO_CFG, STATUS_CFG,
  useAssumirAnalise, useResolverAnalise, uploadAnexoRelacionamento,
  type AnaliseRelacionamento,
} from '@/hooks/useAnalisesRelacionamento';

interface Props {
  analise: AnaliseRelacionamento | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AnaliseRelacionamentoDrawer({ analise, open, onOpenChange }: Props) {
  const [justificativa, setJustificativa] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const assumir = useAssumirAnalise();
  const resolver = useResolverAnalise();

  useEffect(() => {
    if (analise) {
      setJustificativa(analise.justificativa || '');
      setFile(null);
    }
  }, [analise?.id]);

  if (!analise) return null;

  const t = TIPO_CFG[analise.tipo];
  const s = STATUS_CFG[analise.status];
  const meta: any = analise.metadata || {};
  const isResolvido = analise.status === 'resolvido';

  const handleResolver = async () => {
    try {
      let url = analise.documento_comprobatorio_url;
      if (file) {
        setUploading(true);
        url = await uploadAnexoRelacionamento(analise.id, file);
        setUploading(false);
      }
      await resolver.mutateAsync({
        id: analise.id,
        justificativa,
        documentoUrl: url,
        associadoId: analise.associado_id,
        tipo: analise.tipo,
        placa: meta.placa || meta.placa_antiga,
      });
      onOpenChange(false);
    } catch (e) {
      setUploading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={t.cls}>{t.label}</Badge>
            <Badge className={s.cls}>{s.label}</Badge>
          </div>
          <SheetTitle className="text-xl">{meta.associado_nome || 'Associado'}</SheetTitle>
          <SheetDescription className="space-x-3 text-xs">
            <span>CPF: <span className="font-mono">{meta.associado_cpf || '—'}</span></span>
            <span>Placa: <span className="font-mono">{meta.placa || meta.placa_antiga || '—'}</span></span>
            {analise.termo_assinado_em && (
              <span>
                Termo assinado em{' '}
                {format(new Date(analise.termo_assinado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Documentos / termos */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileSignature className="h-4 w-4" /> Termo de cancelamento
              </div>
              {analise.termo_url ? (
                <a
                  href={analise.termo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Abrir documento assinado <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  URL do termo não disponível diretamente — consulte pelo histórico do associado/contrato.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Atalhos para visualizações existentes */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="text-sm font-medium">Acessos rápidos</div>
              <div className="flex flex-wrap gap-2">
                {analise.associado_id && (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/cadastro/associados/${analise.associado_id}`}>
                      <User className="h-4 w-4 mr-1" /> Ficha do Associado
                    </Link>
                  </Button>
                )}
                {analise.veiculo_id && (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/cadastro/veiculos?id=${analise.veiculo_id}`}>
                      <Car className="h-4 w-4 mr-1" /> Veículo
                    </Link>
                  </Button>
                )}
                {analise.contrato_id && (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/cadastro/contratos/${analise.contrato_id}`}>
                      <FileText className="h-4 w-4 mr-1" /> Contrato
                    </Link>
                  </Button>
                )}
                {analise.associado_id && (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/financeiro/cobrancas?associado=${analise.associado_id}`}>
                      Financeiro
                    </Link>
                  </Button>
                )}
                {analise.associado_id && (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/cadastro/associados/${analise.associado_id}?tab=historico`}>
                      <History className="h-4 w-4 mr-1" /> Histórico
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Ação */}
          {isResolvido ? (
            <Card>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Caso resolvido
                </div>
                <div className="text-xs text-muted-foreground">
                  Em{' '}
                  {analise.resolvido_em
                    ? format(new Date(analise.resolvido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : '—'}
                </div>
                <div>
                  <Label className="text-xs">Justificativa</Label>
                  <p className="text-sm whitespace-pre-wrap">{analise.justificativa || '—'}</p>
                </div>
                {analise.documento_comprobatorio_url && (
                  <div>
                    <Label className="text-xs">Documento comprobatório</Label>
                    <a
                      href={analise.documento_comprobatorio_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm text-primary hover:underline"
                    >
                      Abrir anexo
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-3 space-y-3">
                <div className="text-sm font-medium">Tratativa</div>
                {analise.status === 'pendente' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => assumir.mutate(analise.id)}
                    disabled={assumir.isPending}
                  >
                    {assumir.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Assumir caso
                  </Button>
                )}

                <div className="space-y-1">
                  <Label htmlFor="just">Justificativa (mín. 10 caracteres)</Label>
                  <Textarea
                    id="just"
                    rows={4}
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Descreva o que foi tratado, valores, prazos, decisões..."
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="anexo">Documento comprobatório (opcional)</Label>
                  <Input
                    id="anexo"
                    type="file"
                    accept="image/*,application/pdf,audio/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {file && (
                    <div className="text-xs text-muted-foreground">
                      <Upload className="inline h-3 w-3 mr-1" />
                      {file.name} ({Math.round(file.size / 1024)} KB)
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleResolver}
                  disabled={
                    resolver.isPending || uploading || justificativa.trim().length < 10
                  }
                >
                  {(resolver.isPending || uploading) && (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  )}
                  Marcar como resolvido
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
