"""
音を波形から合成するための部品（楽器・フィルター・残響・書き出し）。
プリンのゲーム（caramel-just-meet/scripts/generate_sounds.py）の部品を、このゲーム用に写したもの。
"""

from __future__ import annotations

import os
import wave

import numpy as np

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
rng = np.random.default_rng(20261011)

# ---------------------------------------------------------------- 基本部品


def t_axis(dur: float) -> np.ndarray:
    return np.arange(int(dur * SR)) / SR


def note_freq(name: str) -> float:
    """'C4' 'Eb3' 'F#5' などを周波数に"""
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    n = names[name[0]]
    rest = name[1:]
    while rest and rest[0] in '#b':
        n += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    octave = int(rest)
    midi = 12 * (octave + 1) + n
    return 440.0 * 2 ** ((midi - 69) / 12)


def env(n: int, attack=0.01, decay=0.1, sustain=0.7, release=0.05) -> np.ndarray:
    a = max(1, int(attack * SR))
    d = max(1, int(decay * SR))
    r = max(1, int(release * SR))
    e = np.full(n, sustain, dtype=float)
    e[:a] = np.linspace(0, 1, a)[: n]
    if a < n:
        seg = e[a : a + d]
        e[a : a + d] = np.linspace(1, sustain, d)[: len(seg)]
    if n > r:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def saw(f: float, t: np.ndarray, detune_cents=0.0, vibrato=0.0) -> np.ndarray:
    """倍音を足して作るノコギリ波（エイリアスなし）"""
    f = f * 2 ** (detune_cents / 1200)
    phase_mod = vibrato * np.sin(2 * np.pi * 5.2 * t) if vibrato else 0
    out = np.zeros_like(t)
    k_max = int(min(40, (SR / 2) // f))
    for k in range(1, k_max + 1):
        out += np.sin(2 * np.pi * k * f * t + k * phase_mod) / k
    return out


def square(f: float, t: np.ndarray, duty=0.5) -> np.ndarray:
    """倍音を足して作る矩形（パルス）波"""
    out = np.zeros_like(t)
    k_max = int(min(30, (SR / 2) // f))
    for k in range(1, k_max + 1):
        out += np.sin(np.pi * k * duty) / k * np.cos(2 * np.pi * k * f * t - np.pi * k * duty)
    return out


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    """FFT でかける簡易ローパス（なだらかに落とす）"""
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    spec *= 1 / np.sqrt(1 + (freqs / cutoff) ** 4)
    return np.fft.irfft(spec, len(x))


def highpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    spec *= 1 - 1 / np.sqrt(1 + (freqs / cutoff) ** 4)
    return np.fft.irfft(spec, len(x))


def bandpass(x: np.ndarray, center: float, width: float) -> np.ndarray:
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    spec *= np.exp(-(((freqs - center) / width) ** 2))
    return np.fft.irfft(spec, len(x))


def reverb(x: np.ndarray, seconds=2.2, wet=0.3, loop=False) -> np.ndarray:
    """減衰するノイズを畳み込む簡易ホールリバーブ。loop=True なら末尾の残響を頭に回して途切れずループさせる"""
    n_ir = int(seconds * SR)
    ir = rng.standard_normal(n_ir) * np.exp(-np.arange(n_ir) / SR * (6.9 / seconds))
    ir = lowpass(ir, 5000)
    ir /= np.sqrt(np.sum(ir**2))
    n = len(x) + n_ir
    size = 1 << int(np.ceil(np.log2(n)))
    wet_sig = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:n]
    if loop:
        tail = wet_sig[len(x) :]
        wet_sig = wet_sig[: len(x)].copy()
        wet_sig[: len(tail)] += tail[: len(x)]
    else:
        x = np.concatenate([x, np.zeros(n_ir)])
    return x * (1 - wet) + wet_sig * wet


def place(track: np.ndarray, sig: np.ndarray, start: float) -> None:
    i = int(start * SR)
    end = min(len(track), i + len(sig))
    if end > i:
        track[i:end] += sig[: end - i]


def normalize(x: np.ndarray, peak=0.89) -> np.ndarray:
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def fade(x: np.ndarray, fin=0.004, fout=0.01) -> np.ndarray:
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def write(name: str, x: np.ndarray) -> None:
    os.makedirs(OUT, exist_ok=True)
    data = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f'{name:22s} {len(x) / SR:5.2f}s')


# ---------------------------------------------------------------- 楽器


def strings(f: float, dur: float, amp=1.0, attack=0.04, release=0.25) -> np.ndarray:
    """弦楽合奏：少しずつずらしたノコギリ波を重ね、ビブラートをかける"""
    t = t_axis(dur + release)
    x = sum(saw(f, t, d, vibrato=0.0025) for d in (-7, 0, 6)) / 3
    x = lowpass(x, min(4200, f * 9))
    e = env(len(t), attack, 0.15, 0.85, release)
    return x * e * amp


def brass(f: float, dur: float, amp=1.0) -> np.ndarray:
    t = t_axis(dur + 0.3)
    x = saw(f, t, 0) * 0.6 + saw(f * 2, t, 3) * 0.2
    bright = lowpass(x, min(5000, f * 7))
    e = env(len(t), 0.03, 0.2, 0.75, 0.3)
    return bright * e * amp


def timpani(f: float, dur=1.4, amp=1.0) -> np.ndarray:
    t = t_axis(dur)
    pitch = f * (1 + 0.15 * np.exp(-t * 18))
    body = np.sin(2 * np.pi * np.cumsum(pitch) / SR) + 0.4 * np.sin(2 * np.pi * np.cumsum(pitch * 1.5) / SR)
    hit = lowpass(rng.standard_normal(len(t)), 900) * np.exp(-t * 40) * 0.6
    return (body * np.exp(-t * 2.6) + hit) * amp


def timpani_roll(f: float, dur: float, amp=1.0) -> np.ndarray:
    out = np.zeros(int((dur + 1.4) * SR))
    k = 0
    while k * 0.07 < dur:
        cresc = 0.35 + 0.65 * (k * 0.07 / dur)
        place(out, timpani(f, 1.4, amp * cresc * (0.85 + 0.3 * rng.random())), k * 0.07)
        k += 1
    return out


def cymbal(dur=2.5, amp=1.0) -> np.ndarray:
    t = t_axis(dur)
    return highpass(rng.standard_normal(len(t)), 5000) * np.exp(-t * 1.8) * amp


def pulse_lead(f: float, dur: float, amp=1.0, duty=0.25) -> np.ndarray:
    t = t_axis(dur)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 6 * t) * np.clip((t - 0.12) * 5, 0, 1)
    x = np.zeros_like(t)
    phase = 2 * np.pi * np.cumsum(f * vib) / SR
    k_max = int(min(24, (SR / 2) // f))
    for k in range(1, k_max + 1):
        x += np.sin(np.pi * k * duty) / k * np.cos(k * phase - np.pi * k * duty)
    return x * env(len(t), 0.005, 0.08, 0.7, 0.04) * amp


def kick(amp=1.0) -> np.ndarray:
    t = t_axis(0.35)
    f = 50 + 110 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * amp


def snare(amp=1.0) -> np.ndarray:
    t = t_axis(0.22)
    noise = bandpass(rng.standard_normal(len(t)), 3000, 2500) * np.exp(-t * 18)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25) * 0.5
    return (noise + tone) * amp


def hat(amp=1.0) -> np.ndarray:
    t = t_axis(0.06)
    return highpass(rng.standard_normal(len(t)), 7000) * np.exp(-t * 70) * amp


def taiko(amp=1.0) -> np.ndarray:
    """和太鼓「ドン」"""
    t = t_axis(0.9)
    f = 70 + 40 * np.exp(-t * 12)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    skin = lowpass(rng.standard_normal(len(t)), 600) * np.exp(-t * 30) * 0.5
    return (body + skin) * amp


def bell(f: float, dur: float, amp=1.0, ratios=(1, 2.76, 5.4, 8.93), decays=(1.6, 2.6, 4.5, 7.0)) -> np.ndarray:
    """非整数倍音を重ねた金属の鐘"""
    t = t_axis(dur)
    x = np.zeros_like(t)
    for i, (r, d) in enumerate(zip(ratios, decays)):
        if f * r < SR / 2:
            x += np.sin(2 * np.pi * f * r * t + i) * np.exp(-t * d) / (1 + i * 0.7)
    return x * env(len(t), 0.002, 0.01, 1, 0.05) * amp


def fm_ping(f: float, dur: float, amp=1.0, index=3.0, ratio=3.5) -> np.ndarray:
    """FM で作る金属的な「キーン」"""
    t = t_axis(dur)
    mod = index * np.exp(-t * 6) * np.sin(2 * np.pi * f * ratio * t)
    x = np.sin(2 * np.pi * f * t + mod)
    return x * np.exp(-t * 3.2) * env(len(t), 0.001, 0.01, 1, 0.04) * amp
