import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Camera, MapPin, CheckCircle2, Loader2, ScanFace, MapPinCheck, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PontoRegistroCard({ tiposPonto }) {
  const [tipo, setTipo] = useState('entrada');
  const [funcId, setFuncId] = useState('');
  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [location, setLocation] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [time, setTime] = useState(new Date());
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [uploadedFotoUrl, setUploadedFotoUrl] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const qc = useQueryClient();

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: () => base44.entities.Funcionario.filter({ status: 'ativo' }, 'nome')
  });

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const { data: pontosHoje = [] } = useQuery({
    queryKey: ['pontos-hoje', funcId, hoje],
    queryFn: () => funcId ? base44.entities.RegistroPonto.filter({ funcionario_id: funcId, data: hoje }) : Promise.resolve([]),
    enabled: !!funcId
  });

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, []);

  useEffect(() => {
    if (pontosHoje.length === 0) setTipo('entrada');
    else if (!pontosHoje.some(p => p.tipo === 'saida_almoco')) setTipo('saida_almoco');
    else if (!pontosHoje.some(p => p.tipo === 'volta_almoco')) setTipo('volta_almoco');
    else if (!pontosHoje.some(p => p.tipo === 'saida')) setTipo('saida');
  }, [pontosHoje]);

  const startCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(true);
    await new Promise(r => setTimeout(r, 100));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.onloadedmetadata = () => video.play().catch(() => {});
      }
    } catch (err) {
      toast.error('Erro ao acessar a câmera. Verifique as permissões.');
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!video || !canvas) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // Inverter horizontalmente se for câmera frontal
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    
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

    canvas.toBlob(async blob => {
      setFoto(blob);
      setFotoPreview(canvas.toDataURL('image/jpeg'));
      
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      setCameraActive(false);

      setIsIdentifying(true);
      try {
        const file = new File([blob], `ponto_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setUploadedFotoUrl(file_url);

        toast.loading('Analisando rosto...', { id: 'face-id' });
        const res = await base44.functions.invoke('identificarFuncionario', { fotoUrl: file_url });
        
        if (res.data && res.data.funcionario_id) {
          setFuncId(res.data.funcionario_id);
          toast.success('Rosto reconhecido!', { id: 'face-id' });
        } else {
          toast.error('Rosto não reconhecido. Certifique-se de ter foto no cadastro e tente novamente.', { id: 'face-id' });
          setFoto(null);
          setFotoPreview(null);
          setUploadedFotoUrl(null);
          startCamera();
        }
      } catch (err) {
        console.error(err);
        toast.error('Erro no reconhecimento. Tente novamente.', { id: 'face-id' });
        setFoto(null);
        setFotoPreview(null);
        setUploadedFotoUrl(null);
        startCamera();
      } finally {
        setIsIdentifying(false);
      }
    }, 'image/jpeg', 0.85);
  };

  const getLocation = () => {
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setLocLoading(false); },
      () => { toast.error('Não foi possível obter localização. Verifique as permissões do navegador.'); setLocLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => { getLocation(); }, []);

  const registrarMut = useMutation({
    mutationFn: async () => {
      if (!funcId) { toast.error('Selecione o funcionário'); throw new Error('funcId'); }
      if (!foto && !uploadedFotoUrl) { toast.error('Capture a foto primeiro'); throw new Error('foto'); }
      if (!location) { toast.error('Aguardando localização...'); throw new Error('location'); }
      
      let finalUrl = uploadedFotoUrl;
      if (!finalUrl) {
        const file = new File([foto], `ponto_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        finalUrl = file_url;
      }
      
      await base44.entities.RegistroPonto.create({
        funcionario_id: funcId,
        data: hoje,
        tipo,
        horario: new Date().toISOString(),
        foto_url: finalUrl,
        latitude: location.latitude,
        longitude: location.longitude,
        dispositivo: navigator.userAgent
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pontos-hoje'] });
      setFoto(null); 
      setFotoPreview(null);
      setUploadedFotoUrl(null);
      setFuncId('');
      toast.success('Ponto registrado com sucesso!', {
        description: `Horário: ${format(new Date(), 'HH:mm:ss')} - ${tiposPonto.find(t=>t.value === tipo)?.label}`
      });
    }
  });

  const selectedFunc = funcionarios.find(f => f.id === funcId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl mx-auto">
      
      {/* Coluna Principal: Relógio e Registro */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Relógio Digital */}
        <Card className="bg-slate-900 text-white overflow-hidden relative border-0 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 to-blue-600/20" />
          <CardContent className="p-8 relative z-10 flex flex-col items-center justify-center min-h-[160px]">
            <div className="text-6xl md:text-8xl font-black tracking-tighter tabular-nums text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-300 drop-shadow-sm">
              {format(time, 'HH:mm:ss')}
            </div>
            <div className="text-lg md:text-xl font-medium text-slate-300 mt-2 uppercase tracking-widest">
              {format(time, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </div>
          </CardContent>
        </Card>

        {/* Formulário de Registro */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-6 space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Colaborador</label>
                <div className="h-12 flex items-center px-3 bg-slate-50 dark:bg-slate-900 border border-input rounded-md text-slate-500 text-sm">
                  {funcId && selectedFunc ? (
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                        {selectedFunc.nome.charAt(0)}
                      </div>
                      <span className="font-medium">{selectedFunc.nome}</span>
                      <span className="text-muted-foreground ml-1 text-xs">({selectedFunc.cargo})</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-2"><ScanFace className="w-4 h-4" /> Aguardando reconhecimento facial...</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tipo de Registro</label>
                <Select value={tipo} onValueChange={setTipo} disabled={!funcId}>
                  <SelectTrigger className="h-12 text-base bg-slate-50 dark:bg-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposPonto.map(t => (
                      <SelectItem key={t.value} value={t.value} className="font-medium">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Câmera e Localização Integrados */}
            <div className={`rounded-xl overflow-hidden border-2 transition-colors ${foto ? 'border-emerald-500' : cameraActive ? 'border-blue-500' : 'border-slate-200 dark:border-slate-700'} relative bg-slate-100 dark:bg-slate-900`}>
              
              <div className="absolute top-3 left-3 z-10 flex gap-2">
                <div className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md ${location ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'}`}>
                  {locLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : location ? <MapPinCheck className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                  {location ? 'GPS OK' : 'Buscando GPS...'}
                </div>
              </div>

              <div className="relative aspect-[4/3] md:aspect-[16/9] w-full bg-black flex items-center justify-center">
                {cameraActive ? (
                  <>
                    <video ref={videoRef} className="w-full h-full object-cover transform -scale-x-100" autoPlay playsInline muted />
                    {/* Guia de Rosto */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-64 border-2 border-white/30 rounded-[100px] border-dashed" />
                    </div>
                  </>
                ) : fotoPreview ? (
                  <>
                    <img src={fotoPreview} className="w-full h-full object-cover" alt="Foto capturada" />
                    {isIdentifying && (
                      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                        <ScanFace className="w-16 h-16 text-blue-400 animate-pulse mb-4" />
                        <p className="text-white font-medium text-lg">Reconhecendo Rosto...</p>
                        <p className="text-slate-300 text-sm mt-2">Buscando na base de dados</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center text-slate-400 p-6 flex flex-col items-center">
                    <ScanFace className="w-16 h-16 mb-4 opacity-50" />
                    <p className="font-medium text-slate-300">Reconhecimento Facial</p>
                    <p className="text-sm text-slate-500 max-w-xs mt-1">A câmera será ativada para validar sua identidade.</p>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Controles da Câmera */}
              <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex gap-3">
                {!cameraActive && !fotoPreview && (
                  <Button onClick={startCamera} className="w-full h-12 text-base gap-2" variant="secondary">
                    <Camera className="w-5 h-5" /> Ativar Câmera
                  </Button>
                )}
                {cameraActive && (
                  <Button onClick={capturePhoto} className="w-full h-12 text-base gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    <ScanFace className="w-5 h-5" /> Capturar Rosto
                  </Button>
                )}
                {fotoPreview && (
                  <Button variant="outline" onClick={() => { setFoto(null); setFotoPreview(null); setUploadedFotoUrl(null); setFuncId(''); startCamera(); }} className="w-full h-12 text-base gap-2">
                    <Camera className="w-5 h-5" /> Capturar Novamente
                  </Button>
                )}
              </div>
            </div>

            {/* Botão Final */}
            <Button 
              onClick={() => registrarMut.mutate()} 
              disabled={registrarMut.isPending || !foto || !location || !funcId} 
              className={`w-full h-16 text-lg font-bold gap-3 transition-all ${(!foto || !location || !funcId) ? '' : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20'}`}
            >
              {registrarMut.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
              {registrarMut.isPending ? 'Registrando...' : 'CONFIRMAR PONTO'}
            </Button>

          </CardContent>
        </Card>
      </div>

      {/* Coluna Lateral: Status do Dia */}
      <div className="lg:col-span-4 space-y-6">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm h-full">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" /> 
              Resumo do Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!funcId ? (
              <div className="p-8 text-center text-slate-500">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <ScanFace className="w-6 h-6 text-slate-400 animate-pulse" />
                </div>
                <p className="font-medium text-sm">Identificação Pendente</p>
                <p className="text-xs mt-1">Posicione-se em frente à câmera e capture seu rosto para visualizar seus registros</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold">
                    {selectedFunc?.nome.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{selectedFunc?.nome}</p>
                    <p className="text-xs text-slate-500">{selectedFunc?.cargo}</p>
                  </div>
                </div>

                <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
                  {tiposPonto.map((tp, idx) => {
                    const reg = pontosHoje.find(p => p.tipo === tp.value);
                    const isNext = tipo === tp.value;
                    
                    return (
                      <div key={tp.value} className={`relative flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                        reg 
                          ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/50' 
                          : isNext 
                            ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/50 shadow-sm'
                            : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 opacity-60'
                      }`}>
                        
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                            reg ? 'bg-emerald-500 text-white' : isNext ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                          }`}>
                            {reg ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${reg ? 'text-emerald-700 dark:text-emerald-400' : isNext ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500'}`}>
                              {tp.label.replace(/🟢 |🟡 |🔵 |🔴 /, '')}
                            </p>
                            {reg && (
                              <p className="text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                                {format(new Date(reg.horario), 'HH:mm:ss')}
                              </p>
                            )}
                            {!reg && isNext && (
                              <p className="text-[10px] uppercase font-bold text-blue-500 mt-0.5 tracking-wider">
                                Próximo
                              </p>
                            )}
                          </div>
                        </div>

                        {reg && reg.foto_url && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-200 shrink-0 shadow-sm z-10">
                            <img src={reg.foto_url} className="w-full h-full object-cover" alt="Foto" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {pontosHoje.length === 4 && (
                  <div className="mt-6 p-4 rounded-xl bg-emerald-500 text-white text-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                    <p className="font-bold text-sm">Jornada Completa</p>
                    <p className="text-xs opacity-90">Todos os registros do dia foram realizados.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}