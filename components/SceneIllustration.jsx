/**
 * 紹介ページのヒーローに置く場面イラスト。
 * アイキャッチ(public/ogp.png)から人物と机だけを取り出したもの。
 */
export default function SceneIllustration({ width = 300 }) {
  return (
    <svg
      viewBox="742 200 416 330"
      width={width}
      height={(width * 330) / 416}
      role="img"
      aria-label="資料を持つ社員と、机の向こうに座る上司のイラスト"
      style={{ display: 'block', maxWidth: '100%' }}
    >
      {/* 影 */}
      <ellipse cx="1000" cy="512" rx="120" ry="14" fill="#B4CBE0" opacity="0.55"/>
      <ellipse cx="812" cy="516" rx="70" ry="12" fill="#B4CBE0" opacity="0.55"/>

      {/* --- 上司: デスクの向こうに座っている --- */}
      <g>
      {/* 椅子の背 */}
      <rect x="1042" y="228" width="26" height="150" rx="12" fill="#9FB6C9"/>
      {/* 胴体(肩を張った姿勢) */}
      <path d="M944 500 L944 370 Q944 328 1000 320 Q1056 328 1056 370 L1056 500 Z" fill="#3E5A75"/>
      {/* 襟とシャツ */}
      <path d="M985 326 L1000 360 L1015 326 L1008 320 L992 320 Z" fill="#F2F6FA"/>
      <path d="M998 352 L1002 352 L1004 392 L996 392 Z" fill="#2B6099"/>
      {/* 首 */}
      <rect x="988" y="296" width="24" height="30" rx="10" fill="#E5BC97"/>
      {/* 頭 */}
      <circle cx="1000" cy="272" r="40" fill="#EFCBA6"/>
      {/* 髪 */}
      <path d="M962 268 Q964 228 1000 228 Q1036 228 1038 268 Q1030 246 1000 246 Q970 246 962 268 Z" fill="#2A3340"/>
      {/* 眉。内側を下げた直線で険しい表情にする */}
      <path d="M977 261 L995 272" stroke="#2A3340" strokeWidth="6" strokeLinecap="round" fill="none"/>
      <path d="M1023 261 L1005 272" stroke="#2A3340" strokeWidth="6" strokeLinecap="round" fill="none"/>
      {/* 腕(机の上で組んでいる) */}
      <path d="M950 400 Q930 420 936 450 L1064 450 Q1070 420 1050 400 Z" fill="#35506A"/>
      </g>

      {/* --- デスク --- */}
      {/* 天板の上に載るノートPC。天板より先に描いて奥行きを出す */}
      <path d="M1052 438 L1058 400 L1104 400 L1110 438 Z" fill="#C3D7E8"/>
      <path d="M1058 434 L1063 405 L1100 405 L1105 434 Z" fill="#EAF1F8"/>
      <rect x="890" y="436" width="248" height="15" rx="5" fill="#EDF4FB" stroke="#BFD3E6" strokeWidth="2"/>
      <rect x="906" y="451" width="216" height="54" fill="#DAE7F2"/>
      <rect x="906" y="451" width="216" height="54" fill="none" stroke="#C6D8E9" strokeWidth="2"/>

      {/* --- 社員: 手前に立って資料を持っている --- */}
      <g>
      {/* 脚 */}
      <rect x="790" y="430" width="18" height="86" rx="8" fill="#22384F"/>
      <rect x="818" y="430" width="18" height="86" rx="8" fill="#22384F"/>
      {/* 胴体(スーツ) */}
      <path d="M776 440 L780 356 Q784 316 813 310 Q842 316 846 356 L850 440 Z" fill="#2B6099"/>
      {/* 襟とシャツ */}
      <path d="M799 313 L813 348 L827 313 L820 307 L806 307 Z" fill="#F2F6FA"/>
      <path d="M811 342 L815 342 L817 378 L809 378 Z" fill="#1C2836"/>
      {/* 首 */}
      <rect x="802" y="286" width="22" height="28" rx="9" fill="#E5BC97"/>
      {/* 頭。首元を軸に少し傾けて、ためらっている様子にする */}
      <g transform="rotate(-7 813 292)">
      <circle cx="813" cy="262" r="38" fill="#EFCBA6"/>
      {/* 髪 */}
      <path d="M777 258 Q779 220 813 220 Q847 220 849 258 Q841 236 813 236 Q785 236 777 258 Z" fill="#2A3340"/>
      {/* 眉。外側を下げた八の字の直線で困り顔にする */}
      <path d="M791 268 L808 258" stroke="#2A3340" strokeWidth="6" strokeLinecap="round" fill="none"/>
      <path d="M835 268 L818 258" stroke="#2A3340" strokeWidth="6" strokeLinecap="round" fill="none"/>
      {/* 汗 */}
      <path d="M849 252 Q859 268 849 274 Q839 268 849 252 Z" fill="#8FBEE2"/>
      <path d="M846 265 Q847 259 850 256" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round"
      fill="none" opacity="0.8"/>
      </g>
      {/* 両腕 */}
      <rect x="770" y="352" width="17" height="64" rx="8" fill="#2B6099"/>
      <rect x="839" y="352" width="17" height="64" rx="8" fill="#2B6099"/>
      {/* 手 */}
      <circle cx="778" cy="420" r="9" fill="#E5BC97"/>
      <circle cx="848" cy="420" r="9" fill="#E5BC97"/>
      {/* 体の前で持っている資料 */}
      <g transform="rotate(-5 813 424)">
      <rect x="786" y="398" width="54" height="60" rx="4" fill="#FFFFFF" stroke="#C6D8E9" strokeWidth="2"/>
      <line x1="796" y1="414" x2="830" y2="414" stroke="#C6D8E9" strokeWidth="3" strokeLinecap="round"/>
      <line x1="796" y1="428" x2="830" y2="428" stroke="#C6D8E9" strokeWidth="3" strokeLinecap="round"/>
      <line x1="796" y1="442" x2="816" y2="442" stroke="#C6D8E9" strokeWidth="3" strokeLinecap="round"/>
      </g>
      </g>


    </svg>
  );
}
