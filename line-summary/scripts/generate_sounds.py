"""
「要約の達人 〜上司の長文LINEを1文字で読め〜」の BGM と効果音を合成して assets/sounds/ に書き出す。

プリンゲームと同じく、外部の音源は一切使わず、すべて波形から作った自作の音（著作権の心配なし）。
楽器や音の部品は scripts/synth.py にある。曲はどちらもこのスクリプトのオリジナル。

  - line_bgm_title.wav : タイトル。パチンコの大当たり風のファンファーレ＋四つ打ち
  - line_bgm_game.wav  : プレイ中。ハイテンポのユーロビート風
  - line_catch_0〜4.wav: 結論単語キャッチ「シャキーン！」（コンボで音程が上がる）
  - line_praise.wav    : 「タイパ最高！」の脳汁音「キュインキュイン！」
  - line_hit.wav       : ゴミテキストに当たった「ブッブー」
  - line_rage.wav      : 上司ブチギレ「ウーーー（サイレン）＋ドーン」
  - line_calm.wav      : ブチギレを耐え抜いた「ホッ…」
  - line_gameover.wav  : 着信のバイブ「ヴヴッ、ヴヴッ」→ 絶望の「チーン…」
  - line_tear.wav      : 吹き出しを要約した「ビリッ…チョキン！」
  - line_none.wav      : 結論のない吹き出しを要約してしまった「ポコッ」
  - line_clear.wav     : 18:00 になって定時退社「パッパラパー！」＋退勤の鐘
  - line_fever.wav     : 神要約タイム突入「キュインキュインキュイン…ジャーン！」（パチンコの確変風）
  - line_rare.wav      : レア LINE を要約「チャリリリーン！」（コインが降ってくる音）

使い方:  python3 scripts/generate_sounds.py   （numpy が必要）
"""

from __future__ import annotations

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import synth as g  # noqa: E402

from synth import (  # noqa: E402
    SR,
    bandpass,
    bell,
    brass,
    cymbal,
    fade,
    fm_ping,
    hat,
    highpass,
    kick,
    lowpass,
    normalize,
    note_freq,
    place,
    pulse_lead,
    reverb,
    saw,
    snare,
    square,
    t_axis,
)

rng = np.random.default_rng(20261011)


def write(name: str, x: np.ndarray) -> None:
    g.write(name, x)


def bass(f: float, dur: float, amp=1.0) -> np.ndarray:
    t = t_axis(dur)
    x = saw(f, t) * 0.7 + square(f / 2, t) * 0.3
    return lowpass(x, 900) * g.env(len(t), 0.004, 0.06, 0.6, 0.03) * amp


def supersaw(f: float, dur: float, amp=1.0) -> np.ndarray:
    t = t_axis(dur + 0.08)
    x = sum(saw(f, t, d) for d in (-14, -5, 0, 6, 15)) / 5
    return lowpass(x, min(6000, f * 8)) * g.env(len(t), 0.01, 0.1, 0.75, 0.08) * amp


# ---------------------------------------------------------------- BGM


def drums(track: np.ndarray, beat: float, bars: int, offbeat_hat=True, start=0.0) -> None:
    for b in range(bars * 4):
        t0 = start + b * beat
        place(track, kick(0.9), t0)
        if b % 2 == 1:
            place(track, snare(0.55), t0)
        if offbeat_hat:
            place(track, hat(0.35), t0 + beat / 2)
        place(track, hat(0.18), t0 + beat / 4)
        place(track, hat(0.18), t0 + beat * 3 / 4)


def bgm_line_title() -> np.ndarray:
    """大当たり風ファンファーレ（ハ長調）。2 小節のファンファーレ＋6 小節の四つ打ちで 1 ループ"""
    bpm = 150
    beat = 60 / bpm
    bars = 8
    total = bars * 4 * beat
    track = np.zeros(int(total * SR))
    # ファンファーレ「パッパカパーン！」
    fan = [('G4', 0, 0.5), ('G4', 0.5, 0.25), ('G4', 0.75, 0.25), ('C5', 1, 1), ('E5', 2, 0.75), ('D5', 2.75, 0.25),
           ('E5', 3, 0.5), ('G5', 3.5, 0.5), ('C6', 4, 3.5)]
    for n, st, d in fan:
        place(track, brass(note_freq(n), d * beat, 0.5), st * beat)
        place(track, brass(note_freq(n) / 2, d * beat, 0.3), st * beat)
    place(track, cymbal(2.5, 0.35), 4 * beat)
    # 四つ打ち＋ベース＋リード（6 小節）
    drums(track, beat, 6, start=8 * beat)
    prog = ['C3', 'A2', 'F2', 'G2', 'C3', 'G2']
    for bar, root in enumerate(prog):
        for i in range(8):
            f = note_freq(root) * (2 if i % 2 else 1)
            place(track, bass(f, beat / 2 * 0.9, 0.55), (8 + bar * 4) * beat + i * beat / 2)
    lead = ['E5', 'G5', 'C6', 'G5', 'A5', 'C6', 'E6', 'C6', 'F5', 'A5', 'C6', 'A5', 'G5', 'B5', 'D6', 'B5',
            'E6', 'D6', 'C6', 'G5', 'D6', 'C6', 'B5', 'G5']
    for i, n in enumerate(lead):
        place(track, pulse_lead(note_freq(n), beat * 0.95, 0.28), (8 + i) * beat)
    for bar, chord in enumerate([('C5', 'E5', 'G5'), ('A4', 'C5', 'E5'), ('F4', 'A4', 'C5'), ('G4', 'B4', 'D5'),
                                 ('C5', 'E5', 'G5'), ('G4', 'B4', 'D5')]):
        for n in chord:
            place(track, supersaw(note_freq(n), beat * 0.4, 0.12), (8 + bar * 4 + 1.5) * beat)
            place(track, supersaw(note_freq(n), beat * 0.4, 0.12), (8 + bar * 4 + 3.5) * beat)
    track = reverb(track, 1.2, 0.18, loop=True)
    return normalize(fade(track, 0.004, 0.02), 0.8)


def bgm_line_game() -> np.ndarray:
    """ハイテンポのユーロビート風（イ短調）。8 小節で 1 ループ"""
    bpm = 168
    beat = 60 / bpm
    bars = 8
    total = bars * 4 * beat
    track = np.zeros(int(total * SR))
    drums(track, beat, bars)
    prog = ['A2', 'A2', 'F2', 'F2', 'G2', 'G2', 'E2', 'E2']
    for bar, root in enumerate(prog):
        for i in range(8):
            f = note_freq(root) * (2 if i % 2 else 1)
            place(track, bass(f, beat / 2 * 0.85, 0.6), bar * 4 * beat + i * beat / 2)
    # せわしないリフ（16 分音符）
    riff = ['A5', 'E5', 'C6', 'E5', 'B5', 'E5', 'C6', 'D6']
    riff_f = ['A5', 'F5', 'C6', 'F5', 'A5', 'F5', 'C6', 'F6']
    riff_g = ['G5', 'D5', 'B5', 'D5', 'G5', 'D5', 'B5', 'D6']
    riff_e = ['E5', 'B4', 'G#5', 'B4', 'E5', 'B4', 'G#5', 'B5']
    for bar in range(bars):
        notes = [riff, riff, riff_f, riff_f, riff_g, riff_g, riff_e, riff_e][bar]
        for i in range(16):
            n = notes[i % 8]
            place(track, pulse_lead(note_freq(n), beat / 4 * 0.9, 0.2, duty=0.125), bar * 4 * beat + i * beat / 4)
    chords = [('A4', 'C5', 'E5'), ('F4', 'A4', 'C5'), ('G4', 'B4', 'D5'), ('E4', 'G#4', 'B4')]
    for bar in range(bars):
        for n in chords[bar // 2]:
            for k in range(4):
                place(track, supersaw(note_freq(n), beat * 0.35, 0.09), (bar * 4 + k + 0.5) * beat)
    place(track, cymbal(1.5, 0.3), 0)
    track = reverb(track, 0.9, 0.15, loop=True)
    return normalize(fade(track, 0.004, 0.02), 0.8)


# ---------------------------------------------------------------- 効果音

# ド レ ミ ソ ラ（ペンタトニック）でコンボごとに上がっていく
CATCH_STEPS = [0, 2, 4, 7, 9]


def se_catch(step: int) -> np.ndarray:
    """「シャキーン！」：コインっぽい 2 音＋金属のきらめき"""
    f = note_freq('B5') * 2 ** (step / 12)
    out = np.zeros(int(0.6 * SR))
    place(out, fm_ping(f, 0.12, 0.6, 2.0, 2.0), 0)
    place(out, fm_ping(f * 4 / 3, 0.5, 0.8, 3.0, 3.5), 0.07)
    t = t_axis(0.6)
    out += highpass(rng.standard_normal(len(t)), 7000) * np.exp(-t * 30) * 0.3
    return normalize(fade(reverb(out, 0.6, 0.2)[: len(out)]), 0.8)


def se_praise() -> np.ndarray:
    """脳汁「キュインキュイン！」：ぐいっと上がる音を 2 回＋長調のベル"""
    out = np.zeros(int(1.3 * SR))
    for k in range(2):
        dur = 0.26
        t = t_axis(dur)
        f = 700 * (3200 / 700) ** (t / dur)
        ph = 2 * np.pi * np.cumsum(f) / SR
        sweep = (np.sin(ph) + 0.4 * np.sin(2 * ph)) * np.clip(t / 0.01, 0, 1) * np.clip((dur - t) / 0.05, 0, 1)
        place(out, sweep * 0.5, k * 0.24)
    for i, n in enumerate(['C6', 'E6', 'G6']):
        place(out, bell(note_freq(n), 0.8, 0.35, ratios=(1, 2, 3), decays=(5, 8, 11)), 0.5 + i * 0.05)
    return normalize(fade(reverb(out, 0.8, 0.2)[: len(out)]), 0.75)


def se_hit() -> np.ndarray:
    """「ブッブー」：低いブザー 2 回"""
    out = np.zeros(int(0.7 * SR))
    for k, dur in ((0, 0.12), (0.17, 0.38)):
        t = t_axis(dur)
        x = square(196, t, 0.5) * 0.6 + square(207.6, t, 0.5) * 0.4
        place(out, lowpass(x, 1800) * g.env(len(t), 0.003, 0.02, 0.9, 0.03), k)
    return normalize(fade(out), 0.7)


def se_rage() -> np.ndarray:
    """ブチギレ：「ドーン！」のあと、うなるサイレン「ウーーー、ウーーー」"""
    dur = 2.2
    out = np.zeros(int(dur * SR))
    # ドーン
    t = t_axis(1.2)
    f = 45 + 90 * np.exp(-t * 10)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3)
    boom += lowpass(rng.standard_normal(len(t)), 500) * np.exp(-t * 6) * 0.8
    place(out, boom * 1.0, 0)
    # サイレン
    t = t_axis(dur - 0.15)
    f = 620 + 280 * (0.5 - 0.5 * np.cos(2 * np.pi * t / 0.9))
    ph = 2 * np.pi * np.cumsum(f) / SR
    siren = (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * np.clip(t / 0.1, 0, 1)
    place(out, siren * 0.35, 0.15)
    return normalize(fade(out, 0.002, 0.25), 0.85)


def se_calm() -> np.ndarray:
    """「ホッ…」：やわらかく上がる 3 音"""
    out = np.zeros(int(1.2 * SR))
    for i, n in enumerate(['G5', 'C6', 'E6']):
        place(out, bell(note_freq(n), 0.9, 0.5, ratios=(1, 2, 3), decays=(4, 7, 10)), i * 0.11)
    return normalize(fade(reverb(out, 0.9, 0.25)[: len(out)]), 0.7)


def se_gameover() -> np.ndarray:
    """上司からの着信のバイブ「ヴヴッ、ヴヴッ」→ 絶望の「チーン…」"""
    out = np.zeros(int(4.0 * SR))

    def buzz(dur: float) -> np.ndarray:
        t = t_axis(dur)
        x = np.sign(np.sin(2 * np.pi * 150 * t)) * 0.5 + np.sin(2 * np.pi * 300 * t) * 0.3
        x = bandpass(x + rng.standard_normal(len(t)) * 0.1, 400, 500)
        return x * g.env(len(t), 0.01, 0.02, 0.9, 0.02)

    for k, st in enumerate((0.0, 0.2, 0.7, 0.9)):
        place(out, buzz(0.15) * (0.7 if k % 2 == 0 else 0.9), st)
    # おりんの「チーン」：長く尾を引く
    place(out, bell(note_freq('A5'), 3.0, 0.8, ratios=(1, 2.71, 5.15, 8.2), decays=(0.8, 1.4, 2.4, 3.8)), 1.35)
    return normalize(fade(reverb(out, 1.8, 0.28)[: len(out)], 0.002, 0.3), 0.85)


def se_tear() -> np.ndarray:
    """「ビリッ…チョキン！」：紙を裂く音のあとに、はさみの金属音"""
    out = np.zeros(int(0.6 * SR))
    t = t_axis(0.16)
    crackle = rng.standard_normal(len(t)) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 70 * t)))
    rip = bandpass(crackle, 2600, 1800) * np.clip(t / 0.01, 0, 1) * np.exp(-t * 14)
    place(out, rip * 0.8, 0)
    place(out, fm_ping(note_freq('E7'), 0.35, 0.5, 4.0, 2.7), 0.12)
    place(out, fm_ping(note_freq('B6'), 0.3, 0.35, 3.0, 3.1), 0.15)
    return normalize(fade(out), 0.8)


def se_none() -> np.ndarray:
    """「ポコッ」：気の抜けた低い音"""
    t = t_axis(0.3)
    f = 260 * np.exp(-t * 3)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)
    return normalize(fade(lowpass(x, 1500)), 0.6)


def se_clear() -> np.ndarray:
    """定時退社「パッパラパー！」：上がっていくファンファーレ＋退勤の鐘"""
    out = np.zeros(int(2.6 * SR))
    beat = 0.13
    for i, n in enumerate(['C5', 'E5', 'G5', 'C6']):
        place(out, brass(note_freq(n), beat * (3 if i == 3 else 0.9), 0.5), i * beat)
        place(out, brass(note_freq(n) / 2, beat * (3 if i == 3 else 0.9), 0.3), i * beat)
    for i, n in enumerate(['C6', 'E6', 'G6', 'C7']):
        place(out, bell(note_freq(n), 1.6, 0.35, ratios=(1, 2, 3), decays=(3, 5, 7)), 0.55 + i * 0.07)
    place(out, cymbal(2.0, 0.3), 0.39)
    return normalize(fade(reverb(out, 1.4, 0.25)[: len(out)], 0.002, 0.3), 0.85)


def se_fever() -> np.ndarray:
    """神要約タイム突入：うなりが 3 回せり上がって、長調の和音が「ジャーン！」"""
    out = np.zeros(int(2.4 * SR))
    for k in range(3):
        dur = 0.22
        t = t_axis(dur)
        f = (600 + k * 250) * ((3400 + k * 300) / (600 + k * 250)) ** (t / dur)
        ph = 2 * np.pi * np.cumsum(f) / SR
        sweep = (np.sin(ph) + 0.4 * np.sin(2 * ph)) * np.clip(t / 0.01, 0, 1) * np.clip((dur - t) / 0.04, 0, 1)
        place(out, sweep * 0.45, k * 0.2)
    for n in ['C5', 'E5', 'G5', 'C6']:
        place(out, brass(note_freq(n), 1.0, 0.35), 0.66)
    for i, n in enumerate(['C6', 'E6', 'G6', 'C7', 'E7']):
        place(out, bell(note_freq(n), 1.4, 0.3, ratios=(1, 2, 3), decays=(3, 5, 7)), 0.66 + i * 0.05)
    place(out, cymbal(1.6, 0.35), 0.66)
    return normalize(fade(reverb(out, 1.2, 0.22)[: len(out)], 0.002, 0.3), 0.9)


def se_rare() -> np.ndarray:
    """レア LINE「チャリリリーン！」：高いコインの音が駆け上がる"""
    out = np.zeros(int(1.3 * SR))
    notes = ['E6', 'G6', 'B6', 'E7', 'G7', 'B7']
    for i, n in enumerate(notes):
        place(out, fm_ping(note_freq(n), 0.5, 0.45, 2.0, 2.0), i * 0.06)
    place(out, bell(note_freq('E7'), 0.9, 0.35, ratios=(1, 2.4, 3.9), decays=(4, 6, 8)), 0.4)
    return normalize(fade(reverb(out, 0.8, 0.2)[: len(out)]), 0.8)


def main() -> None:
    write('line_bgm_title.wav', bgm_line_title())
    write('line_bgm_game.wav', bgm_line_game())
    for i, st in enumerate(CATCH_STEPS):
        write(f'line_catch_{i}.wav', se_catch(st))
    write('line_praise.wav', se_praise())
    write('line_hit.wav', se_hit())
    write('line_rage.wav', se_rage())
    write('line_calm.wav', se_calm())
    write('line_gameover.wav', se_gameover())
    write('line_tear.wav', se_tear())
    write('line_none.wav', se_none())
    write('line_clear.wav', se_clear())
    write('line_fever.wav', se_fever())
    write('line_rare.wav', se_rare())


if __name__ == '__main__':
    main()
