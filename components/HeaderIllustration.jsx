/**
 * ホーム画面の見出し横に置くイラスト。
 * アイキャッチ(public/ogp.png)と同じ社員を、上半身に寄せて描いたもの。
 * 小さく表示するため、顔は眉と汗のみ。
 */
export default function HeaderIllustration({ size = 78 }) {
  return (
    <svg
      // 左に余白を含め、手のあたりで切る
      viewBox="758 198 202 234"
      width={size}
      height={(size * 234) / 202}
      role="img"
      aria-label="資料を持って考えている社員のイラスト"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* 胴体(スーツ) */}
      <path d="M776 440 L780 356 Q784 316 813 310 Q842 316 846 356 L850 440 Z" fill="#2B6099" />
      {/* 襟とネクタイ */}
      <path d="M799 313 L813 348 L827 313 L820 307 L806 307 Z" fill="#F2F6FA" />
      <path d="M811 342 L815 342 L817 378 L809 378 Z" fill="#1C2836" />
      {/* 首 */}
      <rect x="802" y="286" width="22" height="28" rx="9" fill="#E5BC97" />

      {/* 頭。首元を軸に少し傾けて、ためらっている様子にする */}
      <g transform="rotate(-7 813 292)">
        <circle cx="813" cy="262" r="38" fill="#EFCBA6" />
        <path
          d="M777 258 Q779 220 813 220 Q847 220 849 258 Q841 236 813 236 Q785 236 777 258 Z"
          fill="#2A3340"
        />
        {/* 八の字の眉 */}
        <path d="M791 268 L808 258" stroke="#2A3340" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M835 268 L818 258" stroke="#2A3340" strokeWidth="6" strokeLinecap="round" fill="none" />
        {/* 汗 */}
        <path d="M849 252 Q859 268 849 274 Q839 268 849 252 Z" fill="#8FBEE2" />
      </g>

      {/* 両腕と手 */}
      <rect x="770" y="352" width="17" height="64" rx="8" fill="#2B6099" />
      <rect x="839" y="352" width="17" height="64" rx="8" fill="#2B6099" />
      <circle cx="778" cy="420" r="9" fill="#E5BC97" />
      <circle cx="848" cy="420" r="9" fill="#E5BC97" />

      {/* 体の前で持っている資料 */}
      <g transform="rotate(-5 813 424)">
        <rect x="786" y="398" width="54" height="60" rx="4" fill="#FFFFFF" stroke="#C6D8E9" strokeWidth="2" />
        <line x1="796" y1="414" x2="830" y2="414" stroke="#C6D8E9" strokeWidth="3" strokeLinecap="round" />
        <line x1="796" y1="428" x2="830" y2="428" stroke="#C6D8E9" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* 心の声の吹き出し */}
      <circle cx="862" cy="266" r="5" fill="#FFFFFF" />
      <circle cx="872" cy="252" r="8" fill="#FFFFFF" />
      <rect x="872" y="204" width="84" height="44" rx="22" fill="#FFFFFF" />
      <text
        x="914"
        y="234"
        textAnchor="middle"
        fontFamily="'Shippori Mincho', serif"
        fontWeight="800"
        fontSize="30"
        fill="#2B6099"
      >
        …
      </text>
    </svg>
  );
}
