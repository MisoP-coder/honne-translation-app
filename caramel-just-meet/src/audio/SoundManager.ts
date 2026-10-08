import { type AudioSource, createAudioPlayer } from 'expo-audio';

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

/**
 * BGM と効果音の管理。
 * - load()：全部の音のプレイヤーを最初にまとめて作り、読み込んでおく（鳴らす瞬間に読み込まないので遅れない）
 * - dispose()：全部のプレイヤーを解放する（expo-av の unloadAsync にあたる）
 * BGM は同時に 1 曲だけ。効果音は毎回頭から鳴らし直す。
 */
export class SoundManager {
  private players = new Map<SoundName, PlayerLike>();
  private currentBgm: BgmName | null = null;
  /** 鳴っていてほしい BGM（ミュート解除やブラウザの再生許可のあとに再開するため） */
  private wantedBgm: BgmName | null = null;
  private muted = false;

  constructor(
    private readonly create: CreatePlayer = (source) => createAudioPlayer(source),
    private readonly sources: Record<SoundName, AudioSource> = SOUND_SOURCES,
  ) {}

  get isMuted() {
    return this.muted;
  }

  get bgm(): BgmName | null {
    return this.currentBgm;
  }

  /** 全部の音を読み込む。何度呼んでもよい */
  load(): void {
    if (this.players.size > 0) return;
    for (const name of Object.keys(this.sources) as SoundName[]) {
      try {
        const player = this.create(this.sources[name]);
        player.volume = VOLUMES[name] ?? 1;
        player.loop = (BGM_NAMES as readonly string[]).includes(name);
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
    if (this.muted) return;
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
    if (this.muted) return;
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
    this.pauseBgm();
  }

  /**
   * ブラウザは、ユーザーが画面に触れるまで音を鳴らさせてくれない。
   * 最初のタップで呼んで、止められていた BGM を鳴らし直す。
   */
  unlock(): void {
    if (this.muted || !this.wantedBgm) return;
    const player = this.players.get(this.wantedBgm);
    try {
      player?.play();
      this.currentBgm = this.wantedBgm;
    } catch {
      // 無視
    }
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    if (muted) {
      for (const player of this.players.values()) {
        try {
          player.pause();
        } catch {
          // 無視
        }
      }
      this.currentBgm = null;
    } else if (this.wantedBgm) {
      this.playBgm(this.wantedBgm);
    }
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
