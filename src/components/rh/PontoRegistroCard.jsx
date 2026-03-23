import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Camera, MapPin, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function PontoRegistroCard({ tiposPonto }) {
  const [tipo, setTipo] = useState('entrada');
  const [funcId, setFuncId] = useState('');
  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [location, setLocation] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const qc = useQueryClient();

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: () => base44.entities.Funcionario.filter({ status: 'ativo' })
  });

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const { data: pontosHoje = [] } = useQuery({
    queryKey: ['pontos-hoje', funcId, hoje],
    queryFn: () => funcId ? base44.entities.RegistroPonto.filter({ funcionario_id: funcId, data: hoje }) : Promise.resolve([]),
    enabled: !!funcId
  });

  useEffect(() => {
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, []);

  const startCamera = async () => {
    // Limpar stream anterior se existir
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(true);
    // Pequeno delay para garantir que o <video> já está no DOM
    await new Promise(r => setTimeout(r, 100));
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      // No iOS/Safari o play() precisa ser após loadedmetadata
      video.onloadedmetadata = () => {
        video.play().catch(() => {});
      };
    }
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    // Overlay com info
    const now = new Date();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`📅 ${format(now, 'dd/MM/yyyy HH:mm:ss')}`, 10, canvas.height - 55);
    if (location) {
      ctx.font = '13px Arial';
      ctx.fillText(`📍 Lat: ${location.latitude.toFixed(6)} | Lng: ${location.longitude.toFixed(6)}`, 10, canvas.height - 30);
    }
    const tipoLabel = tiposPonto.find(t => t.value === tipo)?.label || tipo;
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`Tipo: ${tipoLabel}`, 10, canvas.height - 8);

    canvas.toBlob(blob => {
      setFoto(blob);
      setFotoPreview(canvas.toDataURL('image/jpeg'));
    }, 'image/jpeg', 0.85);

    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setCameraActive(false);
  };

  const getLocation = () => {
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setLocLoading(false); },
      () => { toast.error('Não foi possível obter localização'); setLocLoading(false); },
      { enableHighAccuracy: true }
    );
  };

  // Obter localização automaticamente ao montar
  useEffect(() => {
    getLocation();
  }, []);

  const registrarMut = useMutation({
    mutationFn: async () => {
      if (!funcId) { toast.error('Selecione o funcionário'); return; }
      if (!foto) { toast.error('Tire a foto primeiro'); return; }
      if (!location) { toast.error('Obtenha a localização primeiro'); return; }
      const file = new File([foto], `ponto_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.RegistroPonto.create({
        funcionario_id: funcId,
        data: hoje,
        tipo,
        horario: new Date().toISOString(),
        foto_url: file_url,
        latitude: location.latitude,
        longitude: location.longitude,
        dispositivo: navigator.userAgent
      });
      qc.invalidateQueries({ queryKey: ['pontos-hoje'] });
      setFoto(null); setFotoPreview(null);
      toast.success('Ponto registrado!');
    }
  });

  const tiposRegistrados = pontosHoje.map(p => p.tipo);
  const tipoLabels = { entrada: 'Entrada', saida_almoco: 'Saída Intervalo', volta_almoco: 'Volta Intervalo', saida: 'Saída' };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Camera className="w-5 h-5" /> Registrar Ponto</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={funcId} onValueChange={setFuncId}>
            <SelectTrigger><SelectValue placeholder="Selecione o funcionário" /></SelectTrigger>
            <SelectContent>{funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome} - {f.cargo}</SelectItem>)}</SelectContent>
          </Select>

          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{tiposPonto.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>

          <div className="space-y-2">
            <Button variant="outline" onClick={getLocation} disabled={locLoading} className="w-full gap-2">
              {locLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              {location ? `📍 ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Obter Localização'}
            </Button>
          </div>

          <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: 300 }}>
            {cameraActive ? (
              <video ref={videoRef} className="w-full" autoPlay playsInline muted />
            ) : fotoPreview ? (
              <img src={fotoPreview} className="w-full" alt="Foto capturada" />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-white/50"><Camera className="w-12 h-12" /></div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="flex gap-2">
            {!cameraActive && !fotoPreview && <Button onClick={startCamera} className="flex-1 gap-2"><Camera className="w-4 h-4" /> Abrir Câmera</Button>}
            {cameraActive && <Button onClick={capturePhoto} className="flex-1 gap-2 bg-red-600 hover:bg-red-700"><Camera className="w-4 h-4" /> Capturar Foto</Button>}
            {fotoPreview && <Button variant="outline" onClick={() => { setFoto(null); setFotoPreview(null); startCamera(); }} className="flex-1">Tirar Novamente</Button>}
          </div>

          <Button onClick={() => registrarMut.mutate()} disabled={registrarMut.isPending || !foto || !location || !funcId} className="w-full gap-2" size="lg">
            {registrarMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Registrar Ponto
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-5 h-5" /> Registros de Hoje</CardTitle></CardHeader>
        <CardContent>
          {!funcId && <p className="text-muted-foreground text-sm">Selecione um funcionário</p>}
          {funcId && pontosHoje.length === 0 && <p className="text-muted-foreground text-sm">Nenhum registro hoje</p>}
          <div className="space-y-3">
            {tiposPonto.map(tp => {
              const reg = pontosHoje.find(p => p.tipo === tp.value);
              return (
                <div key={tp.value} className={`flex items-center gap-3 p-3 rounded-lg border ${reg ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200' : 'bg-slate-50 dark:bg-slate-800 border-slate-200'}`}>
                  <div className={`w-3 h-3 rounded-full ${reg ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{tp.label}</p>
                    {reg && <p className="text-xs text-muted-foreground">{format(new Date(reg.horario), 'HH:mm:ss')}</p>}
                  </div>
                  {reg && reg.foto_url && <img src={reg.foto_url} className="w-10 h-10 rounded object-cover" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}