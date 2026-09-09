# メール文面(日本語)

Supabase が送るメールは初期状態だと英語で、差出人も「Supabase Auth」のままです。
どのアプリからのメールか分からないので、下の文面に差し替えます。

## ⚠️ 先に読んでください:編集にはカスタム SMTP が必要です

**無料プランで Supabase 標準のメール送信を使っているあいだは、件名も本文も編集できません**(入力欄が触れない状態になります)。
これは、無料枠のメール送信がフィッシングメールの配信に悪用された件を受けて、Supabase が新規プロジェクトに対して加えた制限です。

編集できるようにするには、**外部のメール送信サービス(SMTP)を登録する**必要があります。登録すると、無料プランのままでもテンプレートのロックが外れます。

| | Supabase 標準のまま | 外部 SMTP を登録 |
| --- | --- | --- |
| 文面の日本語化 | ✕ できない | ○ できる |
| 差出人名 | `Supabase Auth` 固定 | 自由に設定できる |
| 費用 | 0円 | 無料枠のあるサービスなら0円 |
| 手間 | なし | アカウント作成と設定が必要 |

外部 SMTP を登録するまでは、アプリ側で「差出人 Supabase Auth の英語のメールが届きます」と案内しているので、そちらで補っています。

## 貼り付ける場所

外部 SMTP を登録したあと、Supabase の **Authentication → Emails → Templates**。
スマホの場合は、プロジェクトの URL の末尾に `/auth/templates` を足すと直接開けます。

画面上部のタブで種類を選び、**Subject heading**(件名)と本文の HTML を、それぞれ下の内容に置き換えて **Save** します。

> `{{ .ConfirmationURL }}` は Supabase がリンクの URL に置き換える印です。**消さずにそのまま**残してください。

---

## 1. Reset Password(パスワード再設定)

**件名**

```
【言いにくいことの翻訳】パスワード再設定のご案内
```

**本文**

```html
<div style="background:#ffffff;color:#1C2836;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:15px;line-height:1.9;padding:24px;">
  <p style="font-size:19px;font-weight:bold;margin:0 0 4px;">パスワードの再設定</p>
  <p style="font-size:13px;color:#5E7186;margin:0 0 20px;">言いにくいことの翻訳</p>

  <p style="margin:0 0 20px;">
    パスワード再設定のご依頼を受け付けました。<br>
    下のボタンから、新しいパスワードを決めてください。
  </p>

  <p style="margin:0 0 24px;">
    <a href="{{ .ConfirmationURL }}" style="background:#2B6099;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:bold;display:inline-block;">新しいパスワードを決める</a>
  </p>

  <p style="font-size:13px;color:#5E7186;margin:0 0 20px;line-height:1.8;">
    ボタンが押せないときは、次の URL をブラウザに貼り付けてください。<br>
    <a href="{{ .ConfirmationURL }}" style="color:#2B6099;word-break:break-all;">{{ .ConfirmationURL }}</a>
  </p>

  <div style="background:#F1F5FA;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
    <p style="font-size:13px;color:#1C2836;margin:0;line-height:1.9;">
      ・リンクはおよそ1時間で使えなくなります<br>
      ・<b>再設定をお願いしたときと同じブラウザ</b>で開いてください。メールアプリの中で開くとうまくいかないことがあるので、うまくいかない場合はリンクを長押しして Chrome で開いてください
    </p>
  </div>

  <p style="font-size:13px;color:#5E7186;margin:0;">
    心当たりがない場合は、このメールを削除してください。パスワードはそのままです。
  </p>
</div>
```

---

## 2. Magic Link(メールリンクでのログイン)

**件名**

```
【言いにくいことの翻訳】ログイン用リンク
```

**本文**

```html
<div style="background:#ffffff;color:#1C2836;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:15px;line-height:1.9;padding:24px;">
  <p style="font-size:19px;font-weight:bold;margin:0 0 4px;">ログイン用のリンク</p>
  <p style="font-size:13px;color:#5E7186;margin:0 0 20px;">言いにくいことの翻訳</p>

  <p style="margin:0 0 20px;">
    下のボタンを押すと、パスワードを入力せずにログインできます。
  </p>

  <p style="margin:0 0 24px;">
    <a href="{{ .ConfirmationURL }}" style="background:#2B6099;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:bold;display:inline-block;">ログインする</a>
  </p>

  <p style="font-size:13px;color:#5E7186;margin:0 0 20px;line-height:1.8;">
    ボタンが押せないときは、次の URL をブラウザに貼り付けてください。<br>
    <a href="{{ .ConfirmationURL }}" style="color:#2B6099;word-break:break-all;">{{ .ConfirmationURL }}</a>
  </p>

  <div style="background:#F1F5FA;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
    <p style="font-size:13px;color:#1C2836;margin:0;line-height:1.9;">
      ・リンクはおよそ1時間で使えなくなります<br>
      ・<b>リンクをお願いしたときと同じブラウザ</b>で開いてください
    </p>
  </div>

  <p style="font-size:13px;color:#5E7186;margin:0;">
    心当たりがない場合は、このメールを削除してください。
  </p>
</div>
```

---

## 3. Confirm signup(新規登録の確認)

Confirm email をオフにしている間は送られませんが、オンに戻したときのために入れておきます。

**件名**

```
【言いにくいことの翻訳】メールアドレスの確認
```

**本文**

```html
<div style="background:#ffffff;color:#1C2836;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:15px;line-height:1.9;padding:24px;">
  <p style="font-size:19px;font-weight:bold;margin:0 0 4px;">メールアドレスの確認</p>
  <p style="font-size:13px;color:#5E7186;margin:0 0 20px;">言いにくいことの翻訳</p>

  <p style="margin:0 0 20px;">
    ご登録ありがとうございます。<br>
    下のボタンを押すと登録が完了し、そのまま使いはじめられます。
  </p>

  <p style="margin:0 0 24px;">
    <a href="{{ .ConfirmationURL }}" style="background:#2B6099;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:bold;display:inline-block;">登録を完了する</a>
  </p>

  <p style="font-size:13px;color:#5E7186;margin:0 0 20px;line-height:1.8;">
    ボタンが押せないときは、次の URL をブラウザに貼り付けてください。<br>
    <a href="{{ .ConfirmationURL }}" style="color:#2B6099;word-break:break-all;">{{ .ConfirmationURL }}</a>
  </p>

  <p style="font-size:13px;color:#5E7186;margin:0;">
    心当たりがない場合は、このメールを削除してください。アカウントは作られません。
  </p>
</div>
```

---

## 外部 SMTP の登録先(**Authentication → Emails → SMTP Settings**)

ドメインを持っていない場合、送信元にできるのは「本人確認したメールアドレス1件」だけになります。Gmail のアドレスをそのまま送信元にできますが、**Gmail や Yahoo 宛に届かないことがあります**。これは Gmail 側が、独自ドメインを持たない大量送信者を厳しく扱うようになったためです。

| | 無料枠 | ドメインなしで使えるか |
| --- | --- | --- |
| Brevo | 300通/日 | ○(アドレス1件を認証) |
| SendGrid | 100通/日 | ○(アドレス1件を認証) |
| Resend | 3,000通/月 | ✕(ドメインが必要) |

きちんとやるなら、**独自ドメインを取得**(年1,000〜2,000円程度)して、そのドメインを認証するのが確実です。差出人が `noreply@あなたのドメイン` になるので、アプリの信頼感も上がります。

## リンクの有効期限を変えたいとき

**Authentication → Emails → 「Email OTP Expiration」** で秒数を変更できます(初期値は 3600 秒 = 1時間)。
文面に書いた「およそ1時間」も、変更した場合は合わせて直してください。

## 送信数の制限

無料プランは Supabase の共有メールサーバーを使うため、**1時間あたりの送信数がかなり少なく**設定されています。
テストで続けて送ると届かなくなるので、10分ほど間隔をあけてください。利用者が増えてきたら、上記の外部メール送信サービスの設定が必要になります。
