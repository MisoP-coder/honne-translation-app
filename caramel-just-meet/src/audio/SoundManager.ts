import { type AudioSource, createAudioPlayer } from 'expo-audio';

import { DEFAULT_SOUND_SETTINGS, type SoundSettings, sanitizeSettings } from './settings';
import { BGM_NAMES, type BgmName, SOUND_SOURCES, type SoundName, VOLUMES } from './sounds';

/** expo-audio の AudioPlayer のうち、ここで使う部分（テストで差し替えられるように） */
export interface PlayerLike {
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  remove(): void;
  loop: boolean;
  volume: number;
}

export type CreatePlayer = (source: AudioSource) => PlayerLike;

const isBgm = (name: SoundName): name is BgmName => (BGM_NAMES as readonly string[]).includes(name);

/**
 * BGM と効果音の管理。
 * - load()：全部の音のプレイヤーを最初にまとめて作り、読み込んでおく（鳴らす瞬間に読み込まないので遅れない）
 * - dispose()：全部のプレイヤーを解放する（expo-av の unloadAsync にあたる）
 * BGM は同時に 1 曲だけ。効果音は毎回頭から鳴らし直す。
 * BGM と効果音は、それぞれ別にオン・オフと音量を設定できる。
 */
export class SoundManager {
  private players = new Map<SoundName, PlayerLike>();
  private currentBgm: BgmName | null = null;
  /** 鳴っていてほしい BGM（BGM をオンに戻したときやブラウザの再生許可のあとに再開するため） */
  private wantedBgm: BgmName | null = null;
  private settings: SoundSettings = DEFAULT_SOUND_SETTINGS;
  /** 一時停止中（BGM を途中で止めていて、再開すると続きから流れる） */
  private suspended = false;
  private suspendedBgm: BgmName | null = null;

  constructor(
    private readonly create: CreatePlayer = (source) => createAudioPlayer(source),
    private readonly sources: Record<SoundName, AudioSource> = SOUND_SOURCES,
  ) {}

  get bgm(): BgmName | null {
    return this.currentBgm;
  }

  getSettings(): SoundSettings {
    return this.settings;
  }

  /** 全部の音を読み込む。何度呼んでもよい */
  load(): void {
    if (this.players.size > 0) return;
    for (const name of Object.keys(this.sources) as SoundName[]) {
      try {
        const player = this.create(this.sources[name]);
        player.volume = this.volumeFor(name);
        player.loop = isBgm(name);
        this.players.set(name, player);
      } catch {
        // 1 つ読み込めなくても、ほかの音とゲームは続ける
      }
    }
    if (this.wantedBgm) this.playBgm(this.wantedBgm);
  }

  /** 全部の音を止めて解放する */
  dispose(): void {
    for (const player of this.players.values()) {
      try {
        player.pause();
        player.remove();
      } catch {
        // 解放済みなどは無視
      }
    }
    this.players.clear();
    this.currentBgm = null;
  }

  /** 効果音を頭から鳴らす（同じ音が鳴っている途中でも頭から鳴らし直す） */
  playSe(name: SoundName): void {
    if (!this.seAudible()) return;
    const player = this.players.get(name);
    if (!player) return;
    try {
      void player.seekTo(0).catch(() => {});
      player.play();
    } catch {
      // 鳴らせなくてもゲームは止めない
    }
  }

  playSes(names: readonly SoundName[]): void {
    for (const name of names) this.playSe(name);
  }

  /** BGM を切り替える。同じ曲が鳴っていればそのまま */
  playBgm(name: BgmName): void {
    this.wantedBgm = name;
    if (this.suspended || !this.bgmAudible()) return;
    if (this.currentBgm === name) return;
    this.pauseBgm();
    const player = this.players.get(name);
    if (!player) return;
    try {
      void player.seekTo(0).catch(() => {});
      player.play();
      this.currentBgm = name;
    } catch {
      this.currentBgm = null;
    }
  }

  /** BGM をピタッと止める */
  stopBgm(): void {
    this.wantedBgm = null;
    this.suspendedBgm = null;
    this.pauseBgm();
  }

  /** 一時停止：BGM をその場で止める（頭に戻さない） */
  suspendBgm(): void {
    if (this.suspended) return;
    this.suspended = true;
    this.suspendedBgm = this.currentBgm;
    if (this.currentBgm) {
      try {
        this.players.get(this.currentBgm)?.pause();
      } catch {
        // 無視
      }
    }
    this.currentBgm = null;
  }

  /** 一時停止から戻る：止めたところから続きを流す */
  resumeBgm(): void {
    if (!this.suspended) return;
    this.suspended = false;
    const resumeFrom = this.suspendedBgm;
    this.suspendedBgm = null;
    if (!this.wantedBgm || !this.bgmAudible()) return;
    if (resumeFrom === this.wantedBgm) {
      try {
        this.players.get(resumeFrom)?.play();
        this.currentBgm = resumeFrom;
      } catch {
        this.currentBgm = null;
      }
    } else {
      this.playBgm(this.wantedBgm);
    }
  }

  /** 一時停止を取り消す（BGM は鳴らさない。一時停止のまま別の画面に移るとき用） */
  cancelSuspend(): void {
    this.suspended = false;
    this.suspendedBgm = null;
  }

  /**
   * ブラウザは、ユーザーが画面に触れるまで音を鳴らさせてくれない。
   * 最初のタップで呼んで、止められていた BGM を鳴らし直す。
   */
  unlock(): void {
    if (this.suspended || !this.bgmAudible() || !this.wantedBgm) return;
    const player = this.players.get(this.wantedBgm);
    try {
      player?.play();
      this.currentBgm = this.wantedBgm;
    } catch {
      // 無視
    }
  }

  /** 設定を変える。音量は鳴っている音にもすぐ反映し、オン・オフに合わせて BGM を止めたり再開したりする */
  applySettings(next: Partial<SoundSettings>): SoundSettings {
    const prev = this.settings;
    this.settings = sanitizeSettings({ ...prev, ...next });
    for (const [name, player] of this.players) {
      try {
        player.volume = this.volumeFor(name);
      } catch {
        // 無視
      }
    }
    if (!this.seAudible() && (prev.seEnabled && prev.seVolume > 0)) {
      // 効果音をオフにしたら、鳴っている途中の効果音も止める
      for (const [name, player] of this.players) {
        if (isBgm(name)) continue;
        try {
          player.pause();
        } catch {
          // 無視
        }
      }
    }
    if (!this.bgmAudible()) {
      this.pauseBgm();
      // 一時停止中に BGM をオフにしたら、再開しても続きからは流さない
      this.suspendedBgm = null;
    } else if (!this.suspended && this.wantedBgm && this.currentBgm !== this.wantedBgm) {
      this.playBgm(this.wantedBgm);
    }
    return this.settings;
  }

  /** 実際に設定する音量 = 音ごとの基本音量 × BGM / 効果音の音量 */
  private volumeFor(name: SoundName): number {
    const base = VOLUMES[name] ?? 1;
    return base * (isBgm(name) ? this.settings.bgmVolume : this.settings.seVolume);
  }

  private bgmAudible(): boolean {
    return this.settings.bgmEnabled && this.settings.bgmVolume > 0;
  }

  private seAudible(): boolean {
    return this.settings.seEnabled && this.settings.seVolume > 0;
  }

  private pauseBgm(): void {
    if (!this.currentBgm) return;
    const player = this.players.get(this.currentBgm);
    this.currentBgm = null;
    try {
      player?.pause();
      void player?.seekTo(0).catch(() => {});
    } catch {
      // 無視
    }
  }
}
