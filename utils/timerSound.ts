import { Settings } from "@/types/study";

export type TimerNotificationSound = Settings["notificationSound"];

export function getAudioContextConstructor() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

function getSoundPattern(sound: TimerNotificationSound) {
  if (sound === "bell") return [784, 988, 1175, 988];
  if (sound === "chime") return [660, 880];
  if (sound === "alarm") return [880, 660, 880, 660];
  return [880];
}

export async function playTimerNotificationSound(
  context: AudioContext,
  sound: TimerNotificationSound,
  volume = 0.18
) {
  if (context.state === "suspended") {
    await context.resume();
  }

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (sound === "alarm" ? 1.05 : 0.7));
  gain.connect(context.destination);

  getSoundPattern(sound).forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = sound === "beep" || sound === "alarm" ? "square" : "sine";
    const start = context.currentTime + index * (sound === "alarm" ? 0.18 : 0.14);
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + (sound === "alarm" ? 0.14 : 0.42));
  });
}

