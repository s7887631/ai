import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Trash2, Sparkles, FolderSync, Download, Copy, ExternalLink, Link2, Eye, EyeOff } from 'lucide-react';
import { SavedRecording } from '../types';

interface MeetingRecorderProps {
  onAddCloudNote: (note: { title: string; prompt: string; isMeeting: boolean; link: string }) => void;
  onToast: (msg: string, icon?: string) => void;
}

export const MeetingRecorder: React.FC<MeetingRecorderProps> = ({
  onAddCloudNote,
  onToast,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [timerSecs, setTimerSecs] = useState(0);
  const [aiWorking, setAiWorking] = useState(false);
  const [ghUploading, setGhUploading] = useState(false);
  const [ghUploadedUrl, setGhUploadedUrl] = useState('');

  // GitHub Credentials State (Session managed)
  const [ghToken, setGhToken] = useState(() => sessionStorage.getItem('gh_pat') || '');
  const [showToken, setShowToken] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);

  // Audio Context Ref & Animation Loop for Canvas wave forms
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync session key if loaded
  useEffect(() => {
    const savedKey = sessionStorage.getItem('gh_pat');
    if (savedKey) setGhToken(savedKey);
  }, []);

  // Timers representation
  const formatTimer = (totalSecs: number) => {
    const mm = String(Math.floor(totalSecs / 60)).padStart(2, '0');
    const ss = String(totalSecs % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // Start Voice & Wave Analysers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Init HTML Media Recorder
      const mediaParts: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) mediaParts.push(e.data);
      };

      recorder.onstop = () => {
        onToast('錄音完成！已生成錄音檔案。', '🎉');
      };

      recorder.start(250);

      // Start Web Audio wave dynamic visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      drawWaveform();

      // Setup HTML Speech Recognition
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        const sr = new SpeechRec();
        sr.lang = 'zh-TW';
        sr.continuous = true;
        sr.interimResults = true;

        let accumulated = transcript;
        sr.onresult = (e: any) => {
          let interim = '';
          let final = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
              final += e.results[i][0].transcript;
            } else {
              interim += e.results[i][0].transcript;
            }
          }
          if (final) {
            accumulated += (accumulated ? '\n' : '') + final;
            setTranscript(accumulated + (interim ? '\n' + interim : ''));
          } else {
            setTranscript(accumulated + (interim ? (accumulated ? '\n' : '') + interim : ''));
          }
        };

        sr.onerror = (err: any) => {
          if (err.error !== 'no-speech') {
            console.error('Speech recognition error:', err);
          }
        };

        sr.start();
        speechRecognitionRef.current = sr;
      } else {
        onToast('本學期瀏覽器不支援 Web Speech 語音轉文字，系統仍會進行錄音。', 'ℹ️');
      }

      // Start counting duration
      setTimerSecs(0);
      timerIntervalRef.current = setInterval(() => {
        setTimerSecs((prev) => prev + 1);
      }, 1000);

      setIsRecording(true);
      onToast('錄音中，請對麥克風發言...', '🎙️');

    } catch (err: any) {
      console.error('Mic access failed:', err);
      onToast('無法取得麥克風，請檢查瀏覽器安全性與權限。', '⚠️');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(console.error);
    }

    setIsRecording(false);
  };

  // Perform continuous Canvas rendering wave pulses
  const drawWaveform = () => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    if (!ctx || !analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      const width = canvas.width = canvas.offsetWidth;
      const height = canvas.height = canvas.offsetHeight || 52;

      ctx.fillStyle = '#08080f';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#fa6d9a'; // Styled vibrant pink wave
      ctx.lineWidth = 2;
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    draw();
  };

  // Clean form state
  const clearAll = () => {
    setTranscript('');
    setTimerSecs(0);
    setGhUploadedUrl('');
    onToast('會議記錄與音訊資訊已清除。', '🗑');
  };

  // Call server-side Gemini summary proxy
  const triggerAiSummary = async () => {
    if (!transcript.trim()) {
      onToast('請先講話生成內容，或手動輸入逐字稿再整理！', '⚠️');
      return;
    }

    setAiWorking(true);
    onToast('AI 智慧祕書正在整理逐字稿與編排重點...', '🤖');

    try {
      const response = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          title: meetingTitle || '本次會議備忘錄',
        }),
      });

      const data = await response.json();
      if (data.success && data.summary) {
        setTranscript(data.summary);
        onToast('整理完成！高品質會議記錄已輸出。', '✨');
      } else {
        throw new Error(data.error || 'Server output error');
      }
    } catch (err: any) {
      console.error(err);
      onToast(`AI 整理失敗: ${err.message || err}`, '⚠️');
    } finally {
      setAiWorking(false);
    }
  };

  // Proxy push file to safe GitHub repository
  const submitToGitHub = async () => {
    if (!transcript.trim()) {
      onToast('尚無內容可供存檔。', '⚠️');
      return;
    }

    if (!ghToken) {
      setShowTokenModal(true);
      return;
    }

    setGhUploading(true);
    onToast('正在將會議資料上傳至 GitHub 倉庫...', '📦');

    const cleanTitle = (meetingTitle || 'Meeting_Record').replace(/[\s\/\\:*?"<>|]/g, '_');
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `pics/${cleanTitle}_${today}_${Date.now()}.md`;

    try {
      const response = await fetch('/api/github/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: ghToken,
          owner: 's7887631',
          repo: 'super-duper-octo-waffle',
          path: fileName,
          content: `# ${meetingTitle || '無標題工作紀錄'}\n\n**上傳時間：** ${new Date().toLocaleString()}\n\n---\n\n${transcript}`,
          commitMessage: `docs: Add formal record for ${meetingTitle || 'work session'}`,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setGhUploadedUrl(data.htmlUrl);
        sessionStorage.setItem('gh_pat', ghToken);

        // Save note to Cloud Store
        onAddCloudNote({
          title: meetingTitle || `會議記錄 (${today})`,
          prompt: transcript,
          isMeeting: true,
          link: data.htmlUrl,
        });

        onToast('上傳成功！已同步儲存至專案目錄。', '🐙');
      } else {
        throw new Error(data.error || 'Push error');
      }
    } catch (err: any) {
      console.error(err);
      onToast(`上傳 GitHub 失敗: ${err.message || err}`, '❌');
      if (err.message?.includes('401') || err.message?.includes('credentials')) {
        sessionStorage.removeItem('gh_pat');
        setGhToken('');
        setShowTokenModal(true);
      }
    } finally {
      setGhUploading(false);
    }
  };

  const copyToClipboard = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript)
      .then(() => onToast('文稿已複製至剪貼簿', '📋'))
      .catch(console.error);
  };

  return (
    <div className="bg-panel border border-border-custom rounded-2xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-border-custom pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-coral animate-ping" />
          <h3 className="font-display font-semibold text-sm tracking-wide text-brand-coral">🎙️ 會議錄音助理 Pro</h3>
        </div>
        <div className="text-[10px] text-text-muted font-mono bg-ink px-2.5 py-1 rounded-full border border-border-custom">
          WAV RECORD + AI
        </div>
      </div>

      {/* Start Button & Visual Oscilloscope panel */}
      <div className="flex items-center gap-4 bg-ink border border-border-custom p-3.5 rounded-xl">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg cursor-pointer ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 animate-pulse-light text-white'
              : 'bg-gradient-to-r from-brand-coral to-pink-500 hover:scale-105 text-white'
          }`}
          title={isRecording ? '結束錄音' : '開始錄影/音'}
        >
          {isRecording ? <Square size={18} /> : <Mic size={20} />}
        </button>

        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className={`font-mono text-base font-bold ${isRecording ? 'text-brand-coral' : 'text-text-muted'}`}>
              {formatTimer(timerSecs)}
            </span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-text-muted">
              {isRecording ? '• Rec Active' : 'Standby'}
            </span>
          </div>
          <canvas ref={waveCanvasRef} className="w-full h-8 bg-black rounded-md opacity-80" />
        </div>
      </div>

      {/* Structured details form */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-[10px] text-text-muted font-mono tracking-wider uppercase block mb-1">會議主題：</label>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="例如：2026/06 專案架構與截止會議"
            className="w-full bg-surface border border-border-custom/80 focus:border-brand-accent rounded-lg text-xs py-2 px-3 text-text-bright focus:outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-text-muted font-mono tracking-wider uppercase">對答內容與即時逐字稿：</label>
            <div className="flex gap-2">
              <button
                onClick={clearAll}
                className="text-[10px] text-text-muted hover:text-brand-coral flex items-center gap-1 bg-ink/40 px-2 py-0.5 rounded border border-border-custom cursor-pointer"
              >
                <Trash2 size={10} /> 清除
              </button>
              <button
                onClick={triggerAiSummary}
                disabled={aiWorking}
                className="text-[10px] text-brand-accent hover:text-brand-accent/80 flex items-center gap-1 bg-brand-accent/10 px-2 py-0.5 rounded border border-brand-accent/20 font-medium cursor-pointer"
              >
                {aiWorking ? <span className="animate-spin text-[10px]">⏳</span> : <Sparkles size={11} />}
                智能 AI 整理
              </button>
            </div>
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={5}
            placeholder="此處將隨時顯示即時語音辨識的文字，您也可以直接在此手動繕寫、修正會議要點檔案。"
            className="w-full bg-surface border border-border-custom focus:border-brand-accent rounded-lg text-xs p-3 leading-relaxed text-text-bright focus:outline-none font-sans"
          />
        </div>
      </div>

      {/* Buttons block */}
      <div className="grid grid-cols-2 gap-2 mt-1">
        <button
          onClick={submitToGitHub}
          disabled={ghUploading}
          className="bg-brand-accent hover:bg-brand-accent/95 text-xs text-white py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer font-medium shadow-md font-display"
        >
          <FolderSync size={13} />
          上傳至雲端 GitHub
        </button>

        <button
          onClick={copyToClipboard}
          className="bg-ink hover:bg-surface border border-border-custom text-xs text-text-bright py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer font-medium transition-colors"
        >
          <Copy size={13} /> 複製草案
        </button>
      </div>

      {/* Sync visual links if target succeeds */}
      {ghUploadedUrl && (
        <div className="bg-brand-emerald/5 border border-brand-emerald/20 p-2.5 rounded-xl flex items-center justify-between gap-3 animate-fade-in text-[11px]">
          <div className="flex items-center gap-1.5 text-brand-emerald font-medium truncate">
            <Link2 size={12} className="flex-shrink-0" />
            <span className="truncate">已同步至 GitHub 資料庫</span>
          </div>
          <a
            href={ghUploadedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-accent hover:underline flex items-center gap-0.5 flex-shrink-0"
          >
            新分頁開啟 <ExternalLink size={10} />
          </a>
        </div>
      )}

      {/* GitHub Key Configurations Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-panel border border-border-custom max-w-sm w-full p-4.5 rounded-2xl flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-custom pb-2">
              <h4 className="font-display font-semibold text-sm text-text-bright flex items-center gap-2">
                <span>🐙</span> GitHub 儲存庫授權
              </h4>
              <button
                onClick={() => setShowTokenModal(false)}
                className="text-text-muted hover:text-text-bright bg-none border-none text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-surface border border-border-custom p-3 rounded-lg text-xs text-text-muted leading-relaxed">
              <strong>目標上傳儲存庫：</strong><br />
              <code className="text-brand-emerald">s7887631 / super-duper-octo-waffle</code><br />
              上傳後，文件將儲存於 <code className="text-brand-coral">pics/</code> 目錄。
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-text-muted font-mono uppercase tracking-wider block">
                請輸入您的 GitHub PAT Token:
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={ghToken}
                  onChange={(e) => setGhToken(e.target.value)}
                  placeholder="ghp_...................................."
                  className="w-full bg-ink border border-border-custom rounded-lg text-xs py-2 px-3 text-text-bright font-mono pr-8 focus:outline-none"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-bright"
                >
                  {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=meeting-notes-uploader"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-brand-accent hover:underline text-right mt-1"
              >
                前往生成具有 repo 權限的 Token ↗
              </a>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (ghToken) {
                    sessionStorage.setItem('gh_pat', ghToken);
                    setShowTokenModal(false);
                    submitToGitHub();
                  } else {
                    onToast('請輸入 Token！', '⚠️');
                  }
                }}
                className="bg-brand-accent hover:bg-brand-accent/90 text-xs py-2 px-4 rounded-lg text-white font-medium flex-1 cursor-pointer"
              >
                確定上傳
              </button>
              <button
                onClick={() => setShowTokenModal(false)}
                className="bg-ink hover:bg-surface border border-border-custom text-xs py-2 px-4 rounded-lg text-text-bright flex-1 cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
