"""
極限！カラメル・ジャスト・ミート の BGM と効果音を合成して assets/sounds/ に書き出す。

外部の音源は一切使わず、すべてこのスクリプトで波形から作っている（著作権の心配なし）。
BGM の曲はどちらも著作権の切れたクラシック（ベートーヴェン）を、ここで独自に演奏・録音したもの。

  - bgm_title.wav  : 交響曲第5番「運命」冒頭（無駄に壮大なオーケストラ風）
  - bgm_game.wav   : 交響曲第9番「歓喜の歌」（お祭り風チップチューン＋和太鼓）
  - se_drop.wav    : カラメル投下「ヒュゥゥン」
  - se_perfect_0〜7.wav : JUST MEET「ピキーン！」（コンボで音程が上がる。長音階で 8 段階）
  - se_good.wav    : GOOD「ポロン」
  - se_fever.wav   : 10 コンボ以上で重ねる「キュイィィン」（パチンコのリーチ風）
  - se_jackpot.wav : 20 コンボ以上の「確定！」音
  - se_gameover.wav: 拍子木「カッ…カーン」→「チーン…」

使い方:  python3 scripts/generate_sounds.py   （numpy が必要）
"""

from __future__ import annotations

import os
import wave

import numpy as np

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
rng = np.random.default_rng(20261008)

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


# ---------------------------------------------------------------- BGM


def bgm_title() -> np.ndarray:
    """交響曲第5番「運命」冒頭をベースにした、無駄に壮大なループ（ハ短調）"""
    e8 = 0.27  # 8分音符
    total = 19.44
    track = np.zeros(int(total * SR))

    def motif(start: float, short: str, long: str, hold: float, amp=1.0) -> float:
        # ダダダ・ダーン（オクターブ重ねで分厚く）
        for i in range(3):
            for octv, a in ((0, 1.0), (-1, 0.8), (-2, 0.55)):
                n = short[:-1] + str(int(short[-1]) + octv)
                place(track, strings(note_freq(n), e8 * 0.85, amp * a, 0.008, 0.08), start + e8 * (i + 1))
        for octv, a in ((0, 1.0), (-1, 0.8), (-2, 0.6)):
            n = long[:-1] + str(int(long[-1]) + octv)
            place(track, strings(note_freq(n), hold, amp * a, 0.01, 0.6), start + e8 * 4)
        place(track, timpani(note_freq('C2') if 'E' in long else note_freq('G1'), 1.6, 0.9), start + e8 * 4)
        return start + e8 * 4 + hold

    t = 0.0
    t = motif(t, 'G4', 'Eb4', 1.9)
    t = motif(t + 0.1, 'F4', 'D4', 2.1)

    # 畳みかけるように上がっていく
    seq = [('G4', 'Eb4'), ('Ab4', 'G4'), ('Eb5', 'C5'), ('F5', 'D5')]
    for short, long in seq:
        for i in range(3):
            for octv, a in ((0, 0.9), (-1, 0.7)):
                n = short[:-1] + str(int(short[-1]) + octv)
                place(track, strings(note_freq(n), e8 * 0.8, a, 0.006, 0.06), t + e8 * i)
        for octv, a in ((0, 0.9), (-1, 0.7)):
            n = long[:-1] + str(int(long[-1]) + octv)
            place(track, strings(note_freq(n), e8 * 1.7, a, 0.008, 0.12), t + e8 * 3)
        t += e8 * 5

    # 金管とティンパニの大トゥッティ：Cm → Ab → Fm → G7
    chords = [
        (['C3', 'Eb3', 'G3', 'C4', 'Eb4', 'G4'], 'C2'),
        (['Ab2', 'C3', 'Eb3', 'Ab3', 'C4', 'Eb4'], 'Ab1'),
        (['F2', 'Ab2', 'C3', 'F3', 'Ab3', 'C4'], 'F1'),
        (['G2', 'B2', 'D3', 'F3', 'G3', 'B3', 'D4'], 'G1'),
    ]
    beat = e8 * 2
    for notes, root in chords:
        for n in notes:
            place(track, brass(note_freq(n), beat * 1.6, 0.32), t)
            place(track, strings(note_freq(n), beat * 1.7, 0.18, 0.02, 0.3), t)
        place(track, timpani(note_freq(root) * 2, 1.4, 1.0), t)
        place(track, strings(note_freq(root), beat * 1.8, 0.5, 0.02, 0.3), t)
        t += beat * 1.75
    place(track, cymbal(2.6, 0.35), t - beat * 1.75)

    # 属和音（G）を引っぱってティンパニのロール → 頭の「ダダダダーン」にループ
    remain = total - t - 0.15
    for n in ['G2', 'D3', 'G3', 'B3', 'D4', 'G4']:
        place(track, brass(note_freq(n), remain * 0.8, 0.28), t)
        place(track, strings(note_freq(n), remain * 0.85, 0.2, 0.3, 0.3), t)
    place(track, timpani_roll(note_freq('G2'), remain * 0.85, 0.75), t)
    track = reverb(track, 2.6, 0.32, loop=True)
    return normalize(track, 0.8)


def bgm_game() -> np.ndarray:
    """交響曲第9番「歓喜の歌」をお祭り風チップチューンに（ニ長調・BPM 160）"""
    q = 60 / 160
    melody_c = (
        # 1 段目
        'E E F G G F E D C C D E E. D/ D2'
        # 2 段目
        ' E E F G G F E D C C D E D. C/ C2'
        # 3 段目
        ' D D E C D E/ F/ E C D E/ F/ E D C D G,2'
        # 4 段目
        ' E E F G G F E D C C D E D. C/ C2'
    ).split()
    up = 2  # ハ長調 → ニ長調
    scale = {'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F', 'G': 'G', 'A': 'A', 'B': 'B'}
    events = []
    t = 0.0
    for tok in melody_c:
        name = tok[0]
        low = ',' in tok
        dur = q
        if tok.endswith('2'):
            dur = q * 2
        elif tok.endswith('.'):
            dur = q * 1.5
        elif tok.endswith('/'):
            dur = q * 0.5
        events.append((scale[name] + ('4' if low else '5'), t, dur))
        t += dur
    total = t
    track = np.zeros(int(total * SR) + 1)

    def tr(n: str) -> float:
        return note_freq(n) * 2 ** (up / 12)

    # 主旋律（パルス波）＋ 1 オクターブ上のキラキラ
    for n, start, dur in events:
        place(track, pulse_lead(tr(n), dur * 0.92, 0.42), start)
        place(track, pulse_lead(tr(n) * 2, dur * 0.6, 0.08, 0.125), start)

    # 和音（1 小節 = 4 拍ごと）
    bars = ['C', 'G', 'C', 'G', 'C', 'G', 'C', 'GC', 'G', 'C', 'G', 'CG', 'C', 'G', 'C', 'GC']
    triads = {'C': ['C3', 'E3', 'G3'], 'G': ['G2', 'B2', 'D3']}
    for b, chord_names in enumerate(bars):
        for half, cname in enumerate(chord_names):
            span = 4 / len(chord_names)
            base = b * 4 * q + half * span * q
            root = triads[cname][0]
            # ベース：オクターブを跳ねる 8 分音符
            k = 0
            while k < span * 2:
                n = root if k % 2 == 0 else root[:-1] + str(int(root[-1]) + 1)
                place(track, pulse_lead(tr(n), q * 0.45, 0.32, 0.5), base + k * q / 2)
                k += 1
            # 裏拍の和音（お祭りのチャカチャカ）
            for beat in range(int(span)):
                for n in triads[cname]:
                    place(track, pulse_lead(tr(n) * 2, q * 0.22, 0.07, 0.25), base + (beat + 0.5) * q)

    # ドラム：キック・スネア・ハイハット ＋ 小節頭に和太鼓
    beats = int(round(total / q))
    for i in range(beats):
        place(track, kick(0.55 if i % 2 == 0 else 0.3), i * q)
        if i % 2 == 1:
            place(track, snare(0.35), i * q)
        place(track, hat(0.18), i * q)
        place(track, hat(0.12), i * q + q / 2)
        if i % 4 == 0:
            place(track, taiko(0.6), i * q)
    track = reverb(track, 1.0, 0.12, loop=True)
    return normalize(track, 0.8)


# ---------------------------------------------------------------- 効果音


def se_drop() -> np.ndarray:
    """「ヒュゥゥン」：高い音から下がっていく口笛＋風切り音"""
    dur = 0.6
    t = t_axis(dur)
    f = 1900 * (420 / 1900) ** (t / dur) * (1 + 0.02 * np.sin(2 * np.pi * 11 * t))
    whistle = np.sin(2 * np.pi * np.cumsum(f) / SR)
    wind = bandpass(rng.standard_normal(len(t)), 1400, 900) * 0.35
    e = np.clip(t / 0.03, 0, 1) * np.clip((dur - t) / 0.12, 0, 1)
    return normalize(fade((whistle * 0.7 + wind) * e), 0.7)


# 長音階（ド レ ミ ファ ソ ラ シ ド）でコンボごとに上がっていく
PERFECT_STEPS = [0, 2, 4, 5, 7, 9, 11, 12]


def se_perfect(step: int) -> np.ndarray:
    """「ピキーン！」：シャキッと鳴る金属音＋高いキラキラ"""
    f = note_freq('E6') * 2 ** (step / 12) / 2
    dur = 0.9
    x = fm_ping(f, dur, 0.8, 4.0, 3.5)
    x += fm_ping(f * 2, dur, 0.45, 2.5, 1.41)
    x += bell(f * 4, dur, 0.25, ratios=(1, 1.5, 2.2), decays=(5, 7, 9))
    # 「シャキッ」というアタック
    t = t_axis(dur)
    x += highpass(rng.standard_normal(len(t)), 6000) * np.exp(-t * 45) * 0.5
    return normalize(fade(reverb(x, 0.9, 0.25)), 0.85)


def se_good() -> np.ndarray:
    """「ポロン」：やわらかいベル 2 音"""
    out = np.zeros(int(0.7 * SR))
    place(out, bell(note_freq('A5'), 0.6, 0.6, ratios=(1, 2, 3), decays=(6, 9, 12)), 0)
    place(out, bell(note_freq('E6'), 0.55, 0.6, ratios=(1, 2, 3), decays=(6, 9, 12)), 0.07)
    return normalize(fade(out), 0.7)


def se_fever() -> np.ndarray:
    """「キュイィィン」：パチンコのリーチ風。ぐいっと上がるうなり音"""
    dur = 0.75
    t = t_axis(dur)
    f = 500 * (2600 / 500) ** ((t / dur) ** 0.7)
    x = np.zeros_like(t)
    for detune in (-12, 0, 12):
        ph = 2 * np.pi * np.cumsum(f * 2 ** (detune / 1200)) / SR
        x += np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)
    x = lowpass(x, 6000) * np.clip(t / 0.02, 0, 1) * np.clip((dur - t) / 0.15, 0, 1)
    return normalize(fade(reverb(x, 0.7, 0.2)), 0.6)


def se_jackpot() -> np.ndarray:
    """「確定！」：上がりきったうなり＋長調の和音のベルが一斉に鳴る"""
    out = np.zeros(int(1.6 * SR))
    place(out, se_fever() * 0.6, 0)
    for i, n in enumerate(['C6', 'E6', 'G6', 'C7']):
        place(out, fm_ping(note_freq(n), 1.2, 0.5, 3.0, 3.5), 0.42 + i * 0.04)
        place(out, bell(note_freq(n) / 2, 1.2, 0.3), 0.42 + i * 0.04)
    t = t_axis(1.6)
    out += highpass(rng.standard_normal(len(t)), 5000) * np.exp(-np.maximum(t - 0.42, 0) * 6) * (t > 0.42) * 0.25
    return normalize(fade(reverb(out, 1.4, 0.3)), 0.9)


def se_gameover() -> np.ndarray:
    """拍子木「カッ…カーン」のあとに、気の抜けた「チーン…」"""
    out = np.zeros(int(3.6 * SR))

    def clack(amp: float) -> np.ndarray:
        t = t_axis(0.35)
        click = rng.standard_normal(len(t)) * np.exp(-t * 120)
        res = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in ((1180, 28), (2150, 40), (3300, 55)))
        return (bandpass(click, 2000, 1500) * 0.6 + res * 0.5) * amp

    place(out, clack(0.6), 0.0)
    place(out, clack(1.0), 0.32)
    # おりんの「チーン」：長く尾を引く
    place(out, bell(note_freq('A5'), 3.0, 0.7, ratios=(1, 2.71, 5.15, 8.2), decays=(0.9, 1.5, 2.6, 4.0)), 0.75)
    return normalize(fade(reverb(out, 1.8, 0.28)[: len(out)], 0.002, 0.3), 0.85)


def main() -> None:
    write('bgm_title.wav', bgm_title())
    write('bgm_game.wav', bgm_game())
    write('se_drop.wav', se_drop())
    for i, step in enumerate(PERFECT_STEPS):
        write(f'se_perfect_{i}.wav', se_perfect(step))
    write('se_good.wav', se_good())
    write('se_fever.wav', se_fever())
    write('se_jackpot.wav', se_jackpot())
    write('se_gameover.wav', se_gameover())


if __name__ == '__main__':
    main()
