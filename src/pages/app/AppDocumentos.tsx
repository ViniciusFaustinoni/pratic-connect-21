import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Upload, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyDocumentos } from '@/hooks/useMyData';

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  aprovado: { label: 'Aprovado', icon: CheckCircle, className: 'bg-green-100 text-green-800' },
  pendente: { label: 'Pendente', icon: Clock, className: 'bg-yellow-100 text-yellow-800' },
  em_analise: { label: 'Em Análise', icon: Clock, className: 'bg-blue-100 text-blue-800' },
  reprovado: { label: 'Reprovado', icon: XCircle, className: 'bg-red-100 text-red-800' },
};

const tipoLabels: Record<string, string> = {
  cnh: 'CNH',
  crlv: 'CRLV',
  comprovante_residencia: 'Comprovante de Residência',
  foto_frontal_veiculo: 'Foto Frontal do Veículo',
  foto_traseira_veiculo: 'Foto Traseira do Veículo',
  foto_lateral_esquerda: 'Foto Lateral Esquerda',
  foto_lateral_direita: 'Foto Lateral Direita',
  foto_painel: 'Foto do Painel',
  foto_hodometro: 'Foto do Hodômetro',
  outro: 'Outro',
};

export default function AppDocumentos() {
  const navigate = useNavigate();
  const { data: documentos, isLoading } = useMyDocumentos();

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Meus Documentos</h1>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : documentos && documentos.length > 0 ? (
          documentos.map((doc) => {
            const status = statusConfig[doc.status] || statusConfig.pendente;
            const StatusIcon = status.icon;
            
            return (
              <Card key={doc.id} className="border-0 shadow-sm">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {tipoLabels[doc.tipo] || doc.tipo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Enviado em {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Badge variant="outline" className={status.className}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {status.label}
                  </Badge>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <FileText className="mb-2 h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum documento enviado</p>
            </CardContent>
          </Card>
        )}

        {/* Upload Button */}
        <Button variant="outline" className="w-full min-h-[44px]">
          <Upload className="mr-2 h-4 w-4" />
          Enviar Documento
        </Button>
      </div>
    </div>
  );
}