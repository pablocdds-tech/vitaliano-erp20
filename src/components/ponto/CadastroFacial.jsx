import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScanFace, CheckCircle2, Circle, Camera, X, Loader2, KeyRound, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import useFaceApi from './useFaceApi';

const ANGULOS = [
  { key: 'frontal', label: 'Frontal', instrucao: 'Olhe diretamente para a câmera' },
  { key: 'diagonal_esq', label: 'Diagonal Esquerda', instrucao: 'Vire levemente para a esquerda' },
  { key: 'diagonal_dir', label: 'Diagonal Direita', instrucao: 'Vire levemente para a direita' },
  { key: 'levemente_acima', label: 'Levemente Acima', instrucao: 'Levante o queixo levemente' },
  { key: 'levemente_abaixo', label: 'Levemente Abaixo', instrucao: 'Abaixe o queixo levemente' },
];

export default function CadastroFacial() {
  const [selectedFunc, setSelectedFunc] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [currentAnguloIdx, setCurrentAnguloIdx] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [pinInput, setPinInput] = useState('');
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionRef = useRef(null);
  const qc = useQueryClient();
  const { loaded, loading: faceLoading, loadFaceApi } = useFaceApi();

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios-cadastro'],
    queryFn: () => base44.entities.Funcionario.filter({ status: 'ativo' }, 'nome'),
  });

  const { data: funcPontos = [] } = useQuery({
    queryKey: ['func-pontos-cadastro'],
    queryFn: () => base44.entities.FuncionarioPonto.list(),
  });

  const getFuncPonto = (funcId) => funcPontos.find(fp => fp.funcionario_id === funcId);

  const stopCamera = useCallback(() => {
    if (detectionRef.current) { clearInterval(detectionRef.current); detectionRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCapturing(false);
    setFaceDetected(false);
  }, []);

  useEffect(() => { return () => stopCamera(); }, [stopCamera]);

  const startCaptura = async () => {
    const ok = await loadFaceApi();
    if (!ok) { toast.error('Erro ao carregar modelos de reconhecimento facial.'); return; }
    
    setCapturing(true);
    setCurrentAnguloIdx(0);
    setFaceDetected(false);

    await new Promise(r => setTimeout(r, 200));
    
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => videoRef.current.play().catch(() => {});
    }

    // Start detection loop
    detectionRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      const faceapi = window.faceapi;
      const detections = await faceapi.detectAllFaces(
        videoRef.current,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
      ).withFaceLandmarks().withFaceDescriptors();

      if (detections.length === 1) {
        setFaceDetected(true);
        const score = detections[0].detection.score;
        if (score > 0.85) {
          await capturaAngulo(detections[0].descriptor);
        }
      } else {
        setFaceDetected(false);
      }
    }, 600);
  };

  const capturaAngulo = async (descriptor) => {
    if (!selectedFunc) return;
    
    const angulo = ANGULOS[currentAnguloIdx];
    const funcPonto = getFuncPonto(selectedFunc.id);
    
    const descriptorArray = Array.from(descriptor);
    const novoDescritor = {
      descriptor: descriptorArray,
      angulo: angulo.key,
      capturado_em: new Date().toISOString()
    };

    // Also capture photo for profile
    let fotoUrl = funcPonto?.foto_perfil_url;
    if (currentAnguloIdx === 0 && videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0);
      
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
      const file = new File([blob], `perfil_${selectedFunc.id}.jpg`, { type: 'image/jpeg' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      fotoUrl = file_url;
    }

    const existingDescriptors = funcPonto?.face_descriptors || [];
    const updatedDescriptors = [...existingDescriptors.filter(d => d.angulo !== angulo.key), novoDescritor];
    const completo = updatedDescriptors.length >= 3;

    const data = {
      funcionario_id: selectedFunc.id,
      face_descriptors: updatedDescriptors,
      face_cadastro_completo: completo,
      foto_perfil_url: fotoUrl,
    };

    if (funcPonto) {
      await base44.entities.FuncionarioPonto.update(funcPonto.id, data);
    } else {
      data.status_atual = 'fora';
      await base44.entities.FuncionarioPonto.create(data);
    }

    qc.invalidateQueries({ queryKey: ['func-pontos-cadastro'] });
    toast.success(`Ângulo "${angulo.label}" capturado!`);

    if (currentAnguloIdx + 1 < ANGULOS.length) {
      setCurrentAnguloIdx(prev => prev + 1);
      setFaceDetected(false);
    } else {
      toast.success('Todos os ângulos capturados! Cadastro facial completo.');
      stopCamera();
    }
  };

  const salvarPin = async () => {
    if (!selectedFunc || pinInput.length !== 4) { toast.error('PIN deve ter 4 dígitos.'); return; }
    const funcPonto = getFuncPonto(selectedFunc.id);
    if (funcPonto) {
      await base44.entities.FuncionarioPonto.update(funcPonto.id, { pin_backup: pinInput });
    } else {
      await base44.entities.FuncionarioPonto.create({ funcionario_id: selectedFunc.id, pin_backup: pinInput, status_atual: 'fora' });
    }
    qc.invalidateQueries({ queryKey: ['func-pontos-cadastro'] });
    toast.success('PIN salvo!');
    setPinInput('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Lista de Funcionários */}
      <div className="lg:col-span-4">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Funcionários</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {funcionarios.map(f => {
                  const fp = getFuncPonto(f.id);
                  const completo = fp?.face_cadastro_completo;
                  const qtdAngulos = fp?.face_descriptors?.length || 0;
                  return (
                    <button
                      key={f.id}
                      onClick={() => { setSelectedFunc(f); stopCamera(); setPinInput(fp?.pin_backup || ''); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors ${selectedFunc?.id === f.id ? 'bg-blue-50 dark:bg-blue-950 border-l-2 border-blue-500' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${completo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                        {fp?.foto_perfil_url ? <img src={fp.foto_perfil_url} className="w-full h-full rounded-full object-cover" /> : <ScanFace className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.nome}</p>
                        <p className="text-xs text-muted-foreground">{f.cargo}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {completo ? (
                          <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Completo</Badge>
                        ) : qtdAngulos > 0 ? (
                          <Badge variant="outline" className="text-amber-600 text-[10px]">{qtdAngulos}/3</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 text-[10px]">Pendente</Badge>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Painel de Cadastro */}
      <div className="lg:col-span-8 space-y-4">
        {!selectedFunc ? (
          <Card className="flex items-center justify-center h-[500px]">
            <div className="text-center text-slate-400">
              <ScanFace className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Selecione um funcionário</p>
              <p className="text-sm mt-1">para gerenciar o cadastro facial</p>
            </div>
          </Card>
        ) : (
          <>
            {/* Grid de Ângulos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Cadastro Facial — {selectedFunc.nome}</span>
                  {!capturing && (
                    <Button size="sm" onClick={startCaptura} disabled={faceLoading} className="gap-2">
                      {faceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                      {faceLoading ? 'Carregando...' : 'Iniciar Captura'}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-3 mb-4">
                  {ANGULOS.map((ang, idx) => {
                    const fp = getFuncPonto(selectedFunc.id);
                    const captured = fp?.face_descriptors?.find(d => d.angulo === ang.key);
                    const isCurrent = capturing && idx === currentAnguloIdx;
                    return (
                      <div key={ang.key} className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                        captured ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950' :
                        isCurrent ? 'border-blue-400 bg-blue-50 dark:bg-blue-950 shadow-md' :
                        'border-slate-200 dark:border-slate-800'
                      }`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                          captured ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {captured ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                        </div>
                        <p className="text-[10px] font-medium text-center leading-tight">{ang.label}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Camera Preview */}
                {capturing && (
                  <div className="relative rounded-xl overflow-hidden bg-black">
                    <video ref={videoRef} className="w-full aspect-video object-cover transform -scale-x-100" autoPlay playsInline muted />
                    {/* Face guide */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className={`w-48 h-64 rounded-[100px] border-4 border-dashed transition-colors ${
                        faceDetected ? 'border-emerald-400' : 'border-white/30'
                      }`} />
                    </div>
                    {/* Instruction */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                      <p className="text-white text-center font-medium">{ANGULOS[currentAnguloIdx]?.instrucao}</p>
                      <p className="text-white/60 text-center text-xs mt-1">
                        {faceDetected ? 'Rosto detectado — capturando automaticamente...' : 'Posicione seu rosto na área indicada'}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={stopCamera} className="absolute top-2 right-2 text-white bg-black/50 hover:bg-black/70">
                      <X className="w-5 h-5" />
                    </Button>
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PIN Backup */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><KeyRound className="w-4 h-4" /> PIN de Backup</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-2">PIN de 4 dígitos para usar quando o reconhecimento facial falhar.</p>
                    <Input
                      type="password"
                      maxLength={4}
                      placeholder="0000"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-32 text-center text-lg tracking-[0.5em]"
                    />
                  </div>
                  <Button onClick={salvarPin} disabled={pinInput.length !== 4} size="sm">Salvar PIN</Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}