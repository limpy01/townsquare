import { ref } from "vue";
import type { useAudioStore } from "../stores/audio";

type MenuAudioDetectionOptions = {
  audio: ReturnType<typeof useAudioStore>;
  getAudioThreshold(): number;
  setTalking(isTalking: boolean): void;
};

/** Owns the browser-only microphone graph and speech-volume animation loop. */
export function useMenuAudioDetection({
  audio,
  getAudioThreshold,
  setTalking,
}: MenuAudioDetectionOptions) {
  const microphoneSetting = ref("free");
  const audioContext = ref<AudioContext | null>(null);
  const analyser = ref<AnalyserNode | null>(null);

  const initAudio = async () => {
    if (audioContext.value) return;

    const nextContext = new AudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = nextContext.createMediaStreamSource(stream);
    const nextAnalyser = nextContext.createAnalyser();
    nextAnalyser.fftSize = 256;
    source.connect(nextAnalyser);
    audioContext.value = nextContext;
    analyser.value = nextAnalyser;
  };
  const runAudioDetection = () => {
    const activeAnalyser = analyser.value;
    const activeContext = audioContext.value;
    if (!activeAnalyser || !activeContext) return;

    const dataArray = new Uint8Array(activeAnalyser.frequencyBinCount);
    const humanVoiceRange = { min: 250, max: 400 };
    const detectSpeechActivity = () => {
      if (!analyser.value || !audioContext.value) return;
      activeAnalyser.getByteFrequencyData(dataArray);
      const binSize =
        activeContext.sampleRate / (2 * activeAnalyser.frequencyBinCount);
      let totalVolume = 0;
      for (let index = 0; index < activeAnalyser.frequencyBinCount; index++) {
        const frequency = index * binSize;
        if (
          frequency >= humanVoiceRange.min &&
          frequency <= humanVoiceRange.max
        )
          totalVolume += dataArray[index] ?? 0;
      }

      if (totalVolume > getAudioThreshold() && !audio.isTalking)
        setTalking(true);
      else if (totalVolume <= getAudioThreshold() && audio.isTalking)
        setTalking(false);

      audio.setListeningFrame(requestAnimationFrame(detectSpeechActivity));
    };

    detectSpeechActivity();
  };
  const startListening = (mode: string) => {
    if (audio.listeningFrame || mode !== microphoneSetting.value) return;
    void initAudio().then(runAudioDetection);
  };
  const stopListening = (mode: string) => {
    if (!audio.listeningFrame || mode !== microphoneSetting.value) return;
    cancelAnimationFrame(audio.listeningFrame);
    audio.setListeningFrame(null);
    setTalking(false);
  };

  return { microphoneSetting, startListening, stopListening };
}
