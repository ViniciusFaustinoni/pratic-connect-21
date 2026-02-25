import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, MapPin, Phone } from 'lucide-react';

interface Props {
  terceiro: {
    oficina_nome?: string;
    oficina_endereco?: string;
    oficina_telefone?: string;
    entrega_em?: string;
    reparo_concluido_em?: string;
  };
}

export function TerceiroEntrega({ terceiro }: Props) {
  if (terceiro.entrega_em) {
    return (
      <Card className="border-green-300">
        <CardContent className="pt-6 text-center space-y-3">
          <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
          <h3 className="text-lg font-semibold">Veículo Entregue!</h3>
          <p className="text-sm text-muted-foreground">
            Entregue em {new Date(terceiro.entrega_em).toLocaleDateString('pt-BR')}
          </p>
          <p className="text-xs text-muted-foreground">
            Obrigado! Este processo está encerrado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-300">
      <CardContent className="pt-6 space-y-4">
        <div className="text-center space-y-2">
          <CheckCircle className="h-10 w-10 mx-auto text-green-600" />
          <h3 className="text-lg font-semibold">Seu veículo está pronto!</h3>
          <p className="text-sm text-muted-foreground">
            O reparo foi concluído. Dirija-se à oficina para retirada.
          </p>
        </div>

        {terceiro.oficina_nome && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{terceiro.oficina_nome}</span>
            </div>
            {terceiro.oficina_endereco && (
              <p className="text-sm text-muted-foreground pl-6">{terceiro.oficina_endereco}</p>
            )}
            {terceiro.oficina_telefone && (
              <div className="flex items-center gap-2 pl-6">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{terceiro.oficina_telefone}</span>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Na retirada, realize um test drive e assine o termo de aprovação do serviço.
        </p>
      </CardContent>
    </Card>
  );
}
