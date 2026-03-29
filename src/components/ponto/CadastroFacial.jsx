import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScanFace, CheckCircle2, Circle, Camera, X, Loader2, KeyRound, ChevronRight, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import useFaceApi from './useFaceApi';
import { estimateFaceAngle, classifyAngle, getAngleProximity } from './faceAngleDetector';

const ANGULOS = [
  { key: 'frontal', label: 'Frontal', instrucao: 'Olhe diretamente para a câmera', emoji: '😐' },
  { key: 'diagonal_esq', label: 'Esquerda', instrucao: 'Vire o rosto para a esquerda', emoji: '👈' },
  { key: 'diagonal_dir', label: 'Direita', instrucao: 'Vire o rosto para a direita', emoji: '👉' },
  { key: 'levemente_acima', label: 'Acima', instrucao: 'Levante levemente o queixo', emoji: '👆' },
  { key: 'levemente_abaixo', label: 'Abaixo', instrucao: 'Abaixe levemente o queixo', emoji: '👇' },
];

export default function CadastroFacial() {
  const [selectedFunc, setSelectedFunc] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [capturedAngles, setCapturedAngles] = useState(new Set());
  const [currentDetectedAngle, setCurrentDetectedAngle] = useState(null);
  const [proximity, setProximity] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [angleYaw, setAngleYaw] = useState(0);
  const [anglePitch, setAnglePitch] = useState(0);
  const [pinInput, setPinInput] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionRef = useRef(null);
  const capturedRef = useRef(new Set());
  const holdTimerRef = useRef(null);
  const holdAngleRef = useRef(null);
  const qc = useQueryClient();
  const { loading: faceLoading, loadFaceApi } = useFaceApi();

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios-cadastro'],
    queryFn: () => base44.entities.Funcionario.filter({ status: 'ativo' }, 'nome'),
  });

  const { data: funcPontos = [], refetch: refetchFP } = useQuery({
    queryKey: ['func-pontos-cadastro'],
    queryFn: () => base44.entities.FuncionarioPonto.list(),
  });

  const getFuncPonto = (funcId) => funcPontos.find(fp => fp.funcionario_id === funcId);

  const stopCamera = useCallback(() => {
    if (detectionRef.current) { clearInterval(detectionRef.current); detectionRef.current = null; }
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCapturing(false);
    setFaceDetected(false);
    setCurrentDetectedAngle(null);
    setProximity(0);
  }, []);

  useEffect(() => { return () => stopCamera(); }, [stopCamera]);

  // Sync capturedRef with state
  useEffect(() => { capturedRef.current = capturedAngles; }, [capturedAngles]);

  // Load existing captures when selecting a func
  useEffect(() => {
    if (selectedFunc) {
      const fp = getFuncPonto(selectedFunc.id);
      const existing = new Set((fp?.face_descriptors || []).map(d => d.angulo));
      setCapturedAngles(existing);
      setPinInput(fp?.pin_backup || '');
    }
  }, [selectedFunc, funcPontos]);

  const startCaptura = async () => {
    const ok = await loadFaceApi();
    if (!ok) { toast.error('Erro ao carregar modelos de reconhecimento facial.'); return; }

    // Reset only uncaptured angles
    setCapturing(true);
    setFaceDetected(false);
    setCurrentDetectedAngle(null);

    await new Promise(r => setTimeout(r, 200));

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => videoRef.current.play().catch(() => {});
    }

    // Detection loop — runs continuously, checks angle in real time
    detectionRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || saving) return;
      const faceapi = window.faceapi;

      const detections = await faceapi.detectAllFaces(
        videoRef.current,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
      ).withFaceLandmarks().withFaceDescriptors();

      if (detections.length !== 1) {
        setFaceDetected(false);
        setCurrentDetectedAngle(null);
        setProximity(0);
        if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; holdAngleRef.current = null; }
        return;
      }

      setFaceDetected(true);
      const detection = detections[0];
      const { yaw, pitch } = estimateFaceAngle(detection.landmarks);
      setAngleYaw(yaw);
      setAnglePitch(pitch);

      const detectedAngle = classifyAngle(yaw, pitch);

      // Find next uncaptured angle that matches current head position
      const nextUncaptured = ANGULOS.find(a => !capturedRef.current.has(a.key));
      
      if (!nextUncaptured) {
        // All done
        return;
      }

      // Show proximity to the next target angle
      const prox = getAngleProximity(yaw, pitch, nextUncaptured.key);
      setProximity(prox);

      if (detectedAngle && detectedAngle === nextUncaptured.key) {
        setCurrentDetectedAngle(detectedAngle);

        // Hold for 0.8 seconds in position to capture
        if (holdAngleRef.current !== detectedAngle) {
          holdAngleRef.current = detectedAngle;
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          holdTimerRef.current = setTimeout(() => {
            captureAngle(detectedAngle, detection.descriptor);
          }, 800);
        }
      } else {
        setCurrentDetectedAngle(null);
        if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; holdAngleRef.current = null; }
      }
    }, 400);
  };

  const captureAngle = async (angleKey, descriptor) => {
    if (!selectedFunc || saving || capturedRef.current.has(angleKey)) return;
    setSaving(true);

    const funcPonto = getFuncPonto(selectedFunc.id);
    const descriptorArray = Array.from(descriptor);
    const novoDescritor = {
      descriptor: descriptorArray,
      angulo: angleKey,
      capturado_em: new Date().toISOString()
    };

    // Capture profile photo on frontal
    let fotoUrl = funcPonto?.foto_perfil_url;
    if (angleKey === 'frontal' && videoRef.current && canvasRef.current) {
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
    const updatedDescriptors = [...existingDescriptors.filter(d => d.angulo !== angleKey), novoDescritor];
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

    // Update local state immediately
    const newCaptured = new Set(capturedRef.current);
    newCaptured.add(angleKey);
    setCapturedAngles(newCaptured);
    capturedRef.current = newCaptured;
    holdAngleRef.current = null;

    refetchFP();

    const allCaptured = ANGULOS.every(a => newCaptured.has(a.key));
    if (allCaptured) {
      toast.success('Cadastro facial completo! Todos os 5 ângulos capturados.');
      stopCamera();
    } else if (newCaptured.size >= 3 && newCaptured.size < 5) {
      toast.success(`Ângulo capturado! (${newCaptured.size}/5) — Cadastro já é funcional, continue para melhorar a precisão.`);
    } else {
      toast.success(`Ângulo capturado! (${newCaptured.size}/5)`);
    }

    setSaving(false);
  };

  const resetCadastro = async () => {
    if (!selectedFunc) return;
    const funcPonto = getFuncPonto(selectedFunc.id);
    if (funcPonto) {
      await base44.entities.FuncionarioPonto.update(funcPonto.id, { face_descriptors: [], face_cadastro_completo: false, foto_perfil_url: null });
      setCapturedAngles(new Set());
      refetchFP();
      toast.success('Cadastro facial resetado.');
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
    refetchFP();
    toast.success('PIN salvo!');
  };

  // Determine next angle to capture
  const nextAngle = ANGULOS.find(a => !capturedAngles.has(a.key));
  const progressPercent = (capturedAngles.size / ANGULOS.length) * 100;

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
                      onClick={() => { setSelectedFunc(f); stopCamera(); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors ${selectedFunc?.id === f.id ? 'bg-blue-50 dark:bg-blue-950 border-l-2 border-blue-500' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden ${completo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                        {fp?.foto_perfil_url ? <img src={fp.foto_perfil_url} className="w-full h-full object-cover" alt="" /> : <ScanFace className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.nome}</p>
                        <p className="text-xs text-muted-foreground">{f.cargo}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {completo ? (
                          <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Completo</Badge>
                        ) : qtdAngulos > 0 ? (
                          <Badge variant="outline" className="text-amber-600 text-[10px]">{qtdAngulos}/5</Badge>
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Cadastro Facial — {selectedFunc.nome}</span>
                  <div className="flex gap-2">
                    {capturedAngles.size > 0 && !capturing && (
                      <Button size="sm" variant="outline" onClick={resetCadastro} className="gap-1 text-xs">
                        <RotateCcw className="w-3 h-3" /> Resetar
                      </Button>
                    )}
                    {!capturing && (
                      <Button size="sm" onClick={startCaptura} disabled={faceLoading} className="gap-2">
                        {faceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        {capturedAngles.size > 0 ? 'Continuar Captura' : 'Iniciar Captura'}
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-xs text-muted-foreground">Progresso do cadastro</p>
                    <p className="text-xs font-medium">{capturedAngles.size}/5 ângulos {capturedAngles.size >= 3 && <span className="text-emerald-600">✓ Funcional</span>}</p>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>

                {/* Angle grid */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {ANGULOS.map((ang) => {
                    const captured = capturedAngles.has(ang.key);
                    const isNext = !captured && nextAngle?.key === ang.key;
                    const isDetecting = capturing && currentDetectedAngle === ang.key;
                    return (
                      <div key={ang.key} className={`flex flex-col items-center p-2.5 rounded-lg border-2 transition-all duration-300 ${
                        captured ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950 scale-95' :
                        isDetecting ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/50 shadow-lg shadow-emerald-500/20 scale-105' :
                        isNext && capturing ? 'border-blue-400 bg-blue-50 dark:bg-blue-950 animate-pulse' :
                        'border-slate-200 dark:border-slate-800 opacity-50'
                      }`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 text-lg transition-all ${
                          captured ? 'bg-emerald-500 text-white' :
                          isDetecting ? 'bg-emerald-400 text-white' :
                          isNext && capturing ? 'bg-blue-500 text-white' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>
                          {captured ? <CheckCircle2 className="w-5 h-5" /> : ang.emoji}
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
                    
                    {/* Face guide oval with dynamic color */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="relative">
                        {/* Proximity ring */}
                        <svg className="w-56 h-72 absolute -inset-1" viewBox="0 0 224 288">
                          <ellipse cx="112" cy="144" rx="96" ry="128" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                          <ellipse cx="112" cy="144" rx="96" ry="128" fill="none"
                            stroke={proximity > 0.7 ? '#22c55e' : proximity > 0.4 ? '#eab308' : '#64748b'}
                            strokeWidth="4"
                            strokeDasharray={`${proximity * 804} 804`}
                            strokeLinecap="round"
                            className="transition-all duration-300"
                            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                          />
                        </svg>
                        <div className={`w-52 h-68 rounded-[100px] border-4 border-dashed transition-colors duration-300 ${
                          currentDetectedAngle ? 'border-emerald-400' : faceDetected ? 'border-amber-400' : 'border-white/20'
                        }`} style={{ width: '13rem', height: '17rem' }} />
                      </div>
                    </div>
                    
                    {/* Debug angle indicator */}
                    <div className="absolute top-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
                      Yaw: {angleYaw}° Pitch: {anglePitch}°
                    </div>

                    {/* Instruction */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-5">
                      {nextAngle ? (
                        <>
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="text-2xl">{nextAngle.emoji}</span>
                            <p className="text-white text-lg font-bold">{nextAngle.instrucao}</p>
                          </div>
                          <p className="text-white/50 text-center text-xs">
                            {currentDetectedAngle === nextAngle.key
                              ? '✅ Perfeito! Mantenha a posição...'
                              : saving
                              ? '💾 Salvando...'
                              : faceDetected
                              ? 'Gire lentamente até a posição indicada'
                              : 'Posicione seu rosto na área indicada'}
                          </p>
                        </>
                      ) : (
                        <p className="text-emerald-400 text-center text-lg font-bold">🎉 Todos os ângulos capturados!</p>
                      )}
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
                    <p className="text-xs text-muted-foreground mb-2">PIN de 4 dígitos para quando o reconhecimento facial falhar.</p>
                    <Input type="password" maxLength={4} placeholder="0000" value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-32 text-center text-lg tracking-[0.5em]" />
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