import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScanFace, CheckCircle2, Camera, X, Loader2, KeyRound, ChevronRight, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import useFaceApi from './useFaceApi';
import { estimateFaceAngle, classifyAngle, getAngleProximity } from './faceAngleDetector';

const ANGULOS = [
  { key: 'frontal', label: 'Frontal', instrucao: 'Olhe para a câmera', emoji: '😐' },
  { key: 'diagonal_esq', label: 'Esquerda', instrucao: 'Vire o rosto para a esquerda', emoji: '👈' },
  { key: 'diagonal_dir', label: 'Direita', instrucao: 'Vire o rosto para a direita', emoji: '👉' },
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
  const [showList, setShowList] = useState(true);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionRef = useRef(null);
  const capturedRef = useRef(new Set());
  const holdTimerRef = useRef(null);
  const holdAngleRef = useRef(null);
  const savingRef = useRef(false);
  const cooldownRef = useRef(false);
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
    holdAngleRef.current = null;
    savingRef.current = false;
    cooldownRef.current = false;
  }, []);

  useEffect(() => { return () => stopCamera(); }, [stopCamera]);

  useEffect(() => { capturedRef.current = capturedAngles; }, [capturedAngles]);

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
    if (!ok) { toast.error('Erro ao carregar modelos faciais.'); return; }

    setCapturing(true);
    setFaceDetected(false);
    setCurrentDetectedAngle(null);
    savingRef.current = false;
    cooldownRef.current = false;
    holdAngleRef.current = null;

    await new Promise(r => setTimeout(r, 300));

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => videoRef.current.play().catch(() => {});
    }

    detectionRef.current = setInterval(async () => {
      // Use refs (not state) for gate checks — avoids stale closure issues
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      if (savingRef.current || cooldownRef.current) return;

      const faceapi = window.faceapi;
      let detections;
      try {
        detections = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
        ).withFaceLandmarks().withFaceDescriptors();
      } catch { return; }

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
      const nextUncaptured = ANGULOS.find(a => !capturedRef.current.has(a.key));
      if (!nextUncaptured) return;

      const prox = getAngleProximity(yaw, pitch, nextUncaptured.key);
      setProximity(prox);

      if (detectedAngle && detectedAngle === nextUncaptured.key) {
        setCurrentDetectedAngle(detectedAngle);

        if (holdAngleRef.current !== detectedAngle) {
          holdAngleRef.current = detectedAngle;
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          holdTimerRef.current = setTimeout(() => {
            // Re-check refs at fire time
            if (!savingRef.current && !cooldownRef.current && !capturedRef.current.has(detectedAngle)) {
              captureAngle(detectedAngle, detection.descriptor);
            }
          }, 600);
        }
      } else {
        setCurrentDetectedAngle(null);
        if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; holdAngleRef.current = null; }
      }
    }, 500);
  };

  const captureAngle = async (angleKey, descriptor) => {
    if (!selectedFunc || savingRef.current || capturedRef.current.has(angleKey)) return;

    // Lock immediately via ref
    savingRef.current = true;
    setSaving(true);

    // Clear hold timer to prevent double-fire
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    holdAngleRef.current = null;

    const funcPonto = getFuncPonto(selectedFunc.id);
    const descriptorArray = Array.from(descriptor);
    const novoDescritor = { descriptor: descriptorArray, angulo: angleKey, capturado_em: new Date().toISOString() };

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

    // Update local captured set immediately
    const newCaptured = new Set(capturedRef.current);
    newCaptured.add(angleKey);
    setCapturedAngles(newCaptured);
    capturedRef.current = newCaptured;

    refetchFP();

    const allCaptured = ANGULOS.every(a => newCaptured.has(a.key));
    if (allCaptured) {
      toast.success('Cadastro completo! Todos os ângulos capturados.');
      stopCamera();
      return;
    }
    
    toast.success(`✓ ${ANGULOS.find(a => a.key === angleKey)?.label} capturado (${newCaptured.size}/${ANGULOS.length})`);

    // Cooldown: pause detection for 1.5s so user can reposition
    savingRef.current = false;
    setSaving(false);
    cooldownRef.current = true;
    setCurrentDetectedAngle(null);
    setProximity(0);

    setTimeout(() => {
      cooldownRef.current = false;
    }, 1500);
  };

  const resetCadastro = async () => {
    if (!selectedFunc) return;
    const funcPonto = getFuncPonto(selectedFunc.id);
    if (funcPonto) {
      await base44.entities.FuncionarioPonto.update(funcPonto.id, { face_descriptors: [], face_cadastro_completo: false, foto_perfil_url: null });
      setCapturedAngles(new Set());
      capturedRef.current = new Set();
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

  const nextAngle = ANGULOS.find(a => !capturedAngles.has(a.key));
  const progressPercent = (capturedAngles.size / ANGULOS.length) * 100;

  // Mobile: when capturing, show fullscreen camera
  if (capturing) {
    return <CaptureFullscreen
      videoRef={videoRef}
      canvasRef={canvasRef}
      faceDetected={faceDetected}
      currentDetectedAngle={currentDetectedAngle}
      proximity={proximity}
      nextAngle={nextAngle}
      capturedAngles={capturedAngles}
      saving={saving}
      angleYaw={angleYaw}
      anglePitch={anglePitch}
      cooldown={cooldownRef.current}
      onStop={stopCamera}
    />;
  }

  return (
    <div className="space-y-4">
      {/* Mobile: toggle between list and detail */}
      <div className="lg:hidden">
        {!selectedFunc ? (
          <FuncList funcionarios={funcionarios} getFuncPonto={getFuncPonto} selectedFunc={selectedFunc}
            onSelect={(f) => { setSelectedFunc(f); setShowList(false); }} />
        ) : (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedFunc(null)} className="gap-1 mb-2">
              <ChevronRight className="w-4 h-4 rotate-180" /> Voltar
            </Button>
            <CadastroPanel
              selectedFunc={selectedFunc}
              capturedAngles={capturedAngles}
              progressPercent={progressPercent}
              nextAngle={nextAngle}
              faceLoading={faceLoading}
              pinInput={pinInput}
              setPinInput={setPinInput}
              onStartCaptura={startCaptura}
              onResetCadastro={resetCadastro}
              onSalvarPin={salvarPin}
            />
          </div>
        )}
      </div>

      {/* Desktop: side by side */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <FuncList funcionarios={funcionarios} getFuncPonto={getFuncPonto} selectedFunc={selectedFunc}
            onSelect={(f) => { setSelectedFunc(f); stopCamera(); }} />
        </div>
        <div className="lg:col-span-8">
          {!selectedFunc ? (
            <Card className="flex items-center justify-center h-[500px]">
              <div className="text-center text-slate-400">
                <ScanFace className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Selecione um funcionário</p>
              </div>
            </Card>
          ) : (
            <CadastroPanel
              selectedFunc={selectedFunc}
              capturedAngles={capturedAngles}
              progressPercent={progressPercent}
              nextAngle={nextAngle}
              faceLoading={faceLoading}
              pinInput={pinInput}
              setPinInput={setPinInput}
              onStartCaptura={startCaptura}
              onResetCadastro={resetCadastro}
              onSalvarPin={salvarPin}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ========== Sub-components ========== */

function FuncList({ funcionarios, getFuncPonto, selectedFunc, onSelect }) {
  return (
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
              const qtd = fp?.face_descriptors?.length || 0;
              return (
                <button key={f.id} onClick={() => onSelect(f)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors ${selectedFunc?.id === f.id ? 'bg-blue-50 dark:bg-blue-950 border-l-2 border-blue-500' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden ${completo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {fp?.foto_perfil_url ? <img src={fp.foto_perfil_url} className="w-full h-full object-cover" alt="" /> : <ScanFace className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.nome}</p>
                    <p className="text-xs text-muted-foreground">{f.cargo}</p>
                  </div>
                  {completo ? (
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Completo</Badge>
                  ) : qtd > 0 ? (
                    <Badge variant="outline" className="text-amber-600 text-[10px]">{qtd}/5</Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400 text-[10px]">Pendente</Badge>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function CadastroPanel({ selectedFunc, capturedAngles, progressPercent, nextAngle, faceLoading, pinInput, setPinInput, onStartCaptura, onResetCadastro, onSalvarPin }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex flex-wrap items-center justify-between gap-2">
            <span className="truncate">Cadastro — {selectedFunc.nome}</span>
            <div className="flex gap-2 flex-shrink-0">
              {capturedAngles.size > 0 && (
                <Button size="sm" variant="outline" onClick={onResetCadastro} className="gap-1 text-xs">
                  <RotateCcw className="w-3 h-3" /> Resetar
                </Button>
              )}
              <Button size="sm" onClick={onStartCaptura} disabled={faceLoading} className="gap-2">
                {faceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {capturedAngles.size > 0 ? 'Continuar' : 'Iniciar'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-xs text-muted-foreground">Progresso</p>
              <p className="text-xs font-medium">{capturedAngles.size}/{ANGULOS.length} {capturedAngles.size >= ANGULOS.length && <span className="text-emerald-600">✓ Completo</span>}</p>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          {/* Angles grid — responsive */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {ANGULOS.map(ang => {
              const captured = capturedAngles.has(ang.key);
              return (
                <div key={ang.key} className={`flex flex-col items-center p-1.5 sm:p-2.5 rounded-lg border-2 transition-all ${
                  captured ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950' : 'border-slate-200 dark:border-slate-800 opacity-50'
                }`}>
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-0.5 text-base sm:text-lg ${
                    captured ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}>
                    {captured ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : ang.emoji}
                  </div>
                  <p className="text-[9px] sm:text-[10px] font-medium text-center leading-tight">{ang.label}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* PIN */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><KeyRound className="w-4 h-4" /> PIN de Backup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-2">PIN de 4 dígitos para fallback.</p>
              <Input type="password" maxLength={4} placeholder="0000" value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-32 text-center text-lg tracking-[0.5em]" />
            </div>
            <Button onClick={onSalvarPin} disabled={pinInput.length !== 4} size="sm">Salvar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CaptureFullscreen({ videoRef, canvasRef, faceDetected, currentDetectedAngle, proximity, nextAngle, capturedAngles, saving, angleYaw, anglePitch, cooldown, onStop }) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Video fills screen */}
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover transform -scale-x-100" autoPlay playsInline muted />
        
        {/* Face guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-48 h-64 sm:w-56 sm:h-72">
            <svg className="w-full h-full absolute inset-0" viewBox="0 0 224 288">
              <ellipse cx="112" cy="144" rx="96" ry="128" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
              <ellipse cx="112" cy="144" rx="96" ry="128" fill="none"
                stroke={currentDetectedAngle ? '#22c55e' : proximity > 0.5 ? '#eab308' : '#64748b'}
                strokeWidth="4"
                strokeDasharray={`${proximity * 804} 804`}
                strokeLinecap="round"
                className="transition-all duration-300"
                style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
              />
            </svg>
          </div>
        </div>

        {/* Close button */}
        <button onClick={onStop} className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Debug */}
        <div className="absolute top-4 left-4 bg-black/60 text-white text-[10px] px-2 py-1 rounded font-mono">
          Y:{angleYaw}° P:{anglePitch}°
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Bottom panel */}
      <div className="bg-black/95 px-4 py-4 pb-safe space-y-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        {/* Angle indicators */}
        <div className="flex justify-center gap-2">
          {ANGULOS.map(ang => {
            const captured = capturedAngles.has(ang.key);
            const isNext = nextAngle?.key === ang.key;
            const isDetecting = currentDetectedAngle === ang.key;
            return (
              <div key={ang.key} className={`flex flex-col items-center w-14 transition-all duration-300 ${
                captured ? 'opacity-100' : isDetecting ? 'opacity-100 scale-110' : isNext ? 'opacity-100' : 'opacity-30'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm mb-0.5 transition-all ${
                  captured ? 'bg-emerald-500 text-white' :
                  isDetecting ? 'bg-emerald-400 text-white ring-2 ring-emerald-300' :
                  isNext ? 'bg-blue-500 text-white animate-pulse' :
                  'bg-white/10 text-white/40'
                }`}>
                  {captured ? <CheckCircle2 className="w-5 h-5" /> : ang.emoji}
                </div>
                <p className="text-[9px] text-white/70 text-center font-medium">{ang.label}</p>
              </div>
            );
          })}
        </div>

        {/* Instruction */}
        {nextAngle ? (
          <div className="text-center">
            <p className="text-white text-lg font-bold">{nextAngle.emoji} {nextAngle.instrucao}</p>
            <p className="text-white/40 text-xs mt-0.5">
              {saving ? '💾 Salvando...'
                : cooldown ? '✅ Capturado! Reposicione...'
                : currentDetectedAngle === nextAngle.key ? '✅ Mantenha a posição...'
                : faceDetected ? 'Gire lentamente até a posição'
                : 'Posicione o rosto na área'}
            </p>
          </div>
        ) : (
          <p className="text-emerald-400 text-center text-lg font-bold">🎉 Cadastro completo!</p>
        )}

        {/* Progress */}
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mx-8">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(capturedAngles.size / ANGULOS.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}