import { User, Car, MessageCircle, Mail, Phone, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { UserAvatar } from '@/components/UserAvatar';

const formatCurrency = (value: number | null) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

interface SinistroDetalheSidebarProps {
  sinistro: any;
  handleWhatsApp: (phone: string | null) => void;
}

export function SinistroDetalheSidebar({ sinistro, handleWhatsApp }: SinistroDetalheSidebarProps) {
  return (
    <div className="space-y-4">
      {/* Associado */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5 text-primary" /> Associado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <UserAvatar name={sinistro.associado?.nome} size="lg" />
            <div className="min-w-0">
              <p className="font-semibold truncate">{sinistro.associado?.nome || '-'}</p>
              <p className="text-sm text-muted-foreground">{sinistro.associado?.cpf || '-'}</p>
            </div>
          </div>
          
          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{sinistro.associado?.telefone || '-'}</span>
              </div>
              {sinistro.associado?.telefone && (
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => handleWhatsApp(sinistro.associado?.whatsapp || sinistro.associado?.telefone)}
                >
                  <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{sinistro.associado?.email || '-'}</span>
            </div>

            {(sinistro.associado?.logradouro || sinistro.associado?.cidade) && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                <span>
                  {sinistro.associado.logradouro}
                  {sinistro.associado.numero && `, ${sinistro.associado.numero}`}
                  {sinistro.associado.bairro && ` - ${sinistro.associado.bairro}`}
                  {sinistro.associado.cidade && <><br />{sinistro.associado.cidade}{sinistro.associado.uf && `/${sinistro.associado.uf}`}</>}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Veículo */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Car className="h-5 w-5 text-primary" /> Veículo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Placa grande */}
          <div className="flex items-center justify-center">
            <div className="bg-muted px-6 py-2 rounded-lg border-2 border-foreground/20">
              <span className="text-2xl font-bold tracking-widest">{sinistro.veiculo?.placa || '-'}</span>
            </div>
          </div>

          <div className="text-center">
            <p className="font-medium">
              {sinistro.veiculo?.marca} {sinistro.veiculo?.modelo}
            </p>
            <p className="text-sm text-muted-foreground">
              {sinistro.veiculo?.ano_modelo} • {sinistro.veiculo?.cor || ''}
            </p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Chassi</p>
              <p className="font-mono text-xs truncate">{sinistro.veiculo?.chassi || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">RENAVAM</p>
              <p className="font-mono text-xs">{sinistro.veiculo?.renavam || '-'}</p>
            </div>
          </div>

          <Separator />

          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor FIPE</p>
            <p className="text-xl font-bold text-emerald-600">
              {formatCurrency(sinistro.veiculo?.valor_fipe)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
