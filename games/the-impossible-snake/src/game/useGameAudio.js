import { useCallback, useEffect, useRef } from "react";

const ROOT_NOTES = [73.42, 82.41, 87.31, 98];
const ARPEGGIO = [1, 1.2, 1.5, 2, 1.5, 1.2, 1.8, 1.5];
const POWER_TEMPO = { aegis: 30, fang: 54, phase: 42 };
const POWER_ARPEGGIOS = {
  aegis: [2, 2.5, 3, 4, 3, 2.5, 3.75, 3],
  fang: [1, 1.5, 2, 1.8, 1, 2.4, 2, 1.5],
  phase: [2, 3, 2.4, 4, 3.6, 2.4, 4.5, 3],
};
const BGM_MAX_GAIN = 0.18;
const SFX_MAX_GAIN = 0.88;
const DEFAULT_BGM_VOLUME = 85;
const DEFAULT_SFX_VOLUME = 75;

function volumeGain(volume, maxGain) {
  const normalized = Math.max(0, Math.min(100, Number(volume) || 0)) / 100;
  return normalized * maxGain;
}

function playTone(context, output, frequency, start, duration, volume, wave = "sine") {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(output);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.025);
}

function playSweep(context, output, from, to, start, duration, volume, wave = "sawtooth") {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(output);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function createNoiseBuffer(context) {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playNoise(context, output, buffer, start, duration, volume, frequency, type = "highpass") {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = buffer;
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, start);
  filter.Q.setValueAtTime(type === "bandpass" ? 1.8 : 0.7, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  source.start(start, Math.random() * 0.72);
  source.stop(start + duration + 0.02);
}

function createEngine(context) {
  const master = context.createGain();
  const music = context.createGain();
  const musicFilter = context.createBiquadFilter();
  const sfx = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const delay = context.createDelay(0.8);
  const feedback = context.createGain();
  const wet = context.createGain();
  const noiseBuffer = createNoiseBuffer(context);

  master.gain.value = 0.0001;
  music.gain.value = volumeGain(DEFAULT_BGM_VOLUME, BGM_MAX_GAIN);
  sfx.gain.value = volumeGain(DEFAULT_SFX_VOLUME, SFX_MAX_GAIN);
  musicFilter.type = "lowpass";
  musicFilter.frequency.value = 1100;
  musicFilter.Q.value = 0.7;
  compressor.threshold.value = -20;
  compressor.knee.value = 18;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.012;
  compressor.release.value = 0.24;
  delay.delayTime.value = 0.265;
  feedback.gain.value = 0.2;
  wet.gain.value = 0.12;

  music.connect(musicFilter);
  musicFilter.connect(compressor);
  musicFilter.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(compressor);
  sfx.connect(compressor);
  compressor.connect(master);
  master.connect(context.destination);

  const engine = {
    context,
    master,
    music,
    musicFilter,
    sfx,
    wet,
    noiseBuffer,
    timer: null,
    step: 0,
    nextNoteTime: context.currentTime + 0.08,
    params: {
      enabled: true,
      status: "ready",
      level: 1,
      progress: 0,
      target: 3,
      threat: 0,
      power: null,
      bgmVolume: DEFAULT_BGM_VOLUME,
      sfxVolume: DEFAULT_SFX_VOLUME,
    },
  };

  engine.timer = window.setInterval(() => {
    if (context.state !== "running") return;
    if (engine.nextNoteTime < context.currentTime - 0.5) {
      engine.nextNoteTime = context.currentTime + 0.02;
      engine.step = 0;
    }
    const horizon = context.currentTime + 0.12;

    while (engine.nextNoteTime < horizon) {
      const { status, level, progress, target, threat, power } = engine.params;
      const completion = target ? progress / target : 0;
      const powerDrive = power === "fang" ? 0.4 : power === "phase" ? 0.32 : power ? 0.25 : 0;
      const intensity = Math.min(1, Math.max(threat, completion * 0.42) + powerDrive);
      const tempo = 88 + level * 6 + intensity * 42 + (POWER_TEMPO[power] ?? 0);
      const subdivision = power === "fang" ? 2.75 : power ? 2.5 : 2;
      const stepDuration = 60 / tempo / subdivision;
      const root = ROOT_NOTES[(level - 1) % ROOT_NOTES.length];
      const step = engine.step % 16;
      const playing = status === "playing";
      const menu = status === "menu";

      if (menu && step % 4 === 0) {
        playTone(context, music, root / 2, engine.nextNoteTime, stepDuration * 3.6, 0.036, "triangle");
        playTone(context, music, root * 1.5, engine.nextNoteTime + 0.025, stepDuration * 3.2, 0.012, "sine");
      }

      if (menu && (step === 6 || step === 14)) {
        playTone(context, music, root * 4, engine.nextNoteTime, stepDuration * 3.8, 0.013, "sine");
        playNoise(context, music, noiseBuffer, engine.nextNoteTime, 0.08, 0.008, 5200, "highpass");
      }

      if (playing && step % 4 === 0) {
        playTone(context, music, root, engine.nextNoteTime, stepDuration * 2.7, 0.062, "triangle");
        playTone(context, music, root / 2, engine.nextNoteTime, stepDuration * 1.2, 0.031, "sine");
        playSweep(context, music, 92 + intensity * 24, 44, engine.nextNoteTime, 0.16, 0.026 + intensity * 0.012, "sine");
      }

      if (playing && step % 8 === 0) {
        playTone(context, music, root * 2, engine.nextNoteTime, stepDuration * 7.2, 0.018, "sine");
        playTone(context, music, root * 2.4, engine.nextNoteTime, stepDuration * 7.2, 0.013, "sine");
      }

      if (playing && intensity > 0.2 && step % 2 === 0) {
        const note = root * 2 * ARPEGGIO[(step / 2) % ARPEGGIO.length];
        playTone(context, music, note, engine.nextNoteTime, stepDuration * 0.82, 0.016 + intensity * 0.014, "triangle");
      }

      if (playing && intensity > 0.3 && step % 4 === 2) {
        playNoise(context, music, noiseBuffer, engine.nextNoteTime, 0.045, 0.014 + intensity * 0.01, 4600, "highpass");
      }

      if (playing && intensity > 0.52 && (step === 4 || step === 12)) {
        playNoise(context, music, noiseBuffer, engine.nextNoteTime, 0.11, 0.024 + intensity * 0.012, 860, "bandpass");
      }

      if (playing && intensity > 0.62 && step % 2 === 1) {
        const alarmNote = step % 4 === 1 ? 1180 : 920;
        playTone(context, music, alarmNote, engine.nextNoteTime, 0.04, 0.009 + intensity * 0.006, "square");
      }

      if (playing && power) {
        const powerNotes = POWER_ARPEGGIOS[power];
        const powerNote = root * powerNotes[step % powerNotes.length];
        const wave = power === "fang" ? "sawtooth" : power === "phase" ? "sine" : "triangle";
        playTone(
          context,
          music,
          powerNote,
          engine.nextNoteTime,
          stepDuration * (power === "phase" ? 1.7 : 0.68),
          power === "fang" ? 0.018 : 0.014,
          wave,
        );

        if (step % 2 === 1) {
          playNoise(
            context,
            music,
            noiseBuffer,
            engine.nextNoteTime,
            power === "fang" ? 0.042 : 0.028,
            power === "fang" ? 0.018 : 0.012,
            power === "phase" ? 7200 : 5600,
            "highpass",
          );
        }

        if (power === "fang" && step % 4 === 0) {
          playSweep(context, music, root * 1.6, root * 0.72, engine.nextNoteTime, stepDuration * 1.4, 0.026, "sawtooth");
        }
        if (power === "aegis" && (step === 3 || step === 11)) {
          playTone(context, music, root * 6, engine.nextNoteTime, stepDuration * 2.2, 0.014, "sine");
          playTone(context, music, root * 8, engine.nextNoteTime + 0.025, stepDuration * 2, 0.009, "sine");
        }
        if (power === "phase" && step % 4 === 2) {
          playTone(context, music, root * 5.4, engine.nextNoteTime, stepDuration * 3.4, 0.012, "sine");
        }
      }

      if (!playing && status === "paused" && step === 0) {
        playTone(context, music, root * 2, engine.nextNoteTime, stepDuration * 6, 0.014, "sine");
      }

      engine.nextNoteTime += stepDuration;
      engine.step = (engine.step + 1) % 16;
    }
  }, 28);

  return engine;
}

function setEngineMix(engine) {
  if (!engine) return;
  const { context, master, music, musicFilter, sfx, wet, params } = engine;
  const now = context.currentTime;
  const targetGain = !params.enabled
    ? 0.0001
    : params.status === "menu"
      ? 0.23
    : params.status === "playing"
      ? params.power ? 0.49 : 0.44
      : params.status === "levelup" || params.status === "victory"
        ? 0.36
        : 0.16;
  const powerFilter = params.power === "fang" ? 1800 : params.power === "phase" ? 1300 : params.power ? 900 : 0;
  const filterTarget = 900 + params.level * 180 + params.threat * 2400 + powerFilter;

  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(targetGain, now, 0.08);
  music.gain.cancelScheduledValues(now);
  music.gain.setTargetAtTime(volumeGain(params.bgmVolume, BGM_MAX_GAIN), now, 0.06);
  sfx.gain.cancelScheduledValues(now);
  sfx.gain.setTargetAtTime(volumeGain(params.sfxVolume, SFX_MAX_GAIN), now, 0.04);
  musicFilter.frequency.cancelScheduledValues(now);
  musicFilter.frequency.setTargetAtTime(filterTarget, now, 0.14);
  wet.gain.cancelScheduledValues(now);
  wet.gain.setTargetAtTime(0.1 + params.threat * 0.08 + (params.power === "phase" ? 0.12 : params.power ? 0.035 : 0), now, 0.18);
}

export function useGameAudio({
  event,
  enabled,
  bgmVolume,
  sfxVolume,
  status,
  level,
  progress,
  target,
  threat,
  activePower,
}) {
  const engineRef = useRef(null);

  const prime = useCallback((force = false) => {
    if (!enabled && !force) return null;
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return null;

    if (!engineRef.current) engineRef.current = createEngine(new AudioContext());
    const engine = engineRef.current;
    engine.params.enabled = force || enabled;
    engine.params.bgmVolume = bgmVolume;
    engine.params.sfxVolume = sfxVolume;
    if (engine.context.state === "suspended") engine.context.resume();
    setEngineMix(engine);
    return engine.context;
  }, [bgmVolume, enabled, sfxVolume]);

  const playUi = useCallback((cue = "select") => {
    const context = prime();
    if (!context) return;

    const scheduleCue = () => {
      const engine = engineRef.current;
      if (!engine || engine.context.state !== "running") return;
      const now = engine.context.currentTime;

      if (cue === "confirm") {
        playSweep(engine.context, engine.sfx, 180, 720, now, 0.24, 0.035, "triangle");
        playTone(engine.context, engine.sfx, 880, now + 0.12, 0.2, 0.042, "sine");
      } else if (cue === "back") {
        playSweep(engine.context, engine.sfx, 520, 180, now, 0.2, 0.03, "triangle");
      } else if (cue === "toggle") {
        playTone(engine.context, engine.sfx, 360, now, 0.09, 0.032, "square");
        playTone(engine.context, engine.sfx, 540, now + 0.055, 0.12, 0.025, "triangle");
      } else {
        playTone(engine.context, engine.sfx, 260, now, 0.09, 0.028, "triangle");
        playTone(engine.context, engine.sfx, 520, now + 0.04, 0.12, 0.022, "sine");
      }
    };

    if (context.state === "suspended") context.resume().then(scheduleCue);
    else scheduleCue();
  }, [prime]);

  useEffect(() => {
    const handleGesture = () => prime();
    window.addEventListener("keydown", handleGesture, { once: true });
    window.addEventListener("pointerdown", handleGesture, { once: true });
    return () => {
      window.removeEventListener("keydown", handleGesture);
      window.removeEventListener("pointerdown", handleGesture);
    };
  }, [prime]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.params = {
      enabled,
      status,
      level,
      progress,
      target,
      threat,
      power: activePower?.type ?? null,
      bgmVolume,
      sfxVolume,
    };
    if (enabled && engine.context.state === "suspended") engine.context.resume();
    setEngineMix(engine);
  }, [activePower?.type, bgmVolume, enabled, level, progress, sfxVolume, status, target, threat]);

  useEffect(() => {
    if (!enabled || event.type === "ready" || event.type === "levelstart") return;
    const engine = engineRef.current;
    if (!engine || engine.context.state !== "running") return;
    const { context, sfx } = engine;
    const now = context.currentTime;

    if (event.type === "collect") {
      playTone(context, sfx, 392, now, 0.12, 0.07, "triangle");
      playTone(context, sfx, 659, now + 0.065, 0.18, 0.052, "sine");
    }
    if (event.type === "powerup") {
      const power = event.power ?? "aegis";
      const frequencies = power === "fang"
        ? [165, 330, 660, 990]
        : power === "phase"
          ? [440, 660, 990, 1320]
          : [392, 587, 880, 1175];
      const wave = power === "fang" ? "sawtooth" : power === "phase" ? "sine" : "triangle";
      frequencies.forEach((frequency, index) => {
        playTone(context, sfx, frequency, now + index * 0.045, 0.34, power === "fang" ? 0.046 : 0.052, wave);
      });
      playSweep(
        context,
        sfx,
        power === "fang" ? 110 : 220,
        power === "phase" ? 1320 : 980,
        now,
        0.48,
        power === "fang" ? 0.042 : 0.029,
        power === "fang" ? "sawtooth" : "sine",
      );
    }
    if (event.type === "powerend") {
      [660, 440, 220].forEach((frequency, index) => {
        playTone(context, sfx, frequency, now + index * 0.055, 0.22, 0.022, "sine");
      });
      playSweep(context, sfx, 720, 140, now, 0.36, 0.018, "triangle");
    }
    if (event.type === "shield") {
      playSweep(context, sfx, 980, 210, now, 0.36, 0.065, "sine");
    }
    if (event.type === "hunter") {
      playTone(context, sfx, 116, now, 0.24, 0.075, "sawtooth");
      playTone(context, sfx, 880, now + 0.06, 0.2, 0.05, "square");
    }
    if (event.type === "warning") {
      playTone(context, sfx, 760, now, 0.08, 0.035, "square");
      playTone(context, sfx, 980, now + 0.11, 0.1, 0.045, "square");
    }
    if (event.type === "levelup") {
      [294, 392, 494, 659].forEach((frequency, index) => {
        playTone(context, sfx, frequency, now + index * 0.09, 0.38, 0.052, "triangle");
      });
    }
    if (event.type === "victory") {
      [220, 330, 440, 660].forEach((frequency, index) => {
        playTone(context, sfx, frequency, now + index * 0.11, 0.7, 0.055, "sine");
      });
    }
    if (event.type === "crash") {
      playSweep(context, sfx, 164, 54, now, 0.52, 0.08, "sawtooth");
      playTone(context, sfx, 74, now + 0.08, 0.62, 0.055, "triangle");
    }
  }, [enabled, event.id, event.power, event.type]);

  useEffect(() => () => {
    const engine = engineRef.current;
    if (!engine) return;
    window.clearInterval(engine.timer);
    engine.context.close();
    engineRef.current = null;
  }, []);

  return { prime, playUi };
}
