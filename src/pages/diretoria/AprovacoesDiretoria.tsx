import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PainelAprovacoesDiretoria } from '@/components/aprovacoes/PainelAprovacoesDiretoria';
import { useAprovacoesDiretoria } from '@/hooks/useAprovacoesDiretoria';

export default function AprovacoesDiretoria() {
  const { data: todas = [] } = useAprovacoesDiretoria();

  const pendentes = todas.filter((i) => i.status === 'pendente').length;
  const aprovados = todas.filter((i) => i.status === 'aprovado').length;
  const recusados = todas.filter((i) => i.status === 'recusado').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Aprovações da Diretoria</h1>
        <p className="text-muted-foreground text-sm">
          Acompanhe o status das aprovações FIPE pendentes e veja quais diretores já responderam.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendentes}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{aprovados}</p>
              <p className="text-xs text-muted-foreground">Aprovados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{recusados}</p>
              <p className="text-xs text-muted-foreground">Recusados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <PainelAprovacoesDiretoria />
    </div>
  );
}
