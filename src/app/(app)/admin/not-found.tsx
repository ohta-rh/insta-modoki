// Shown with HTTP 404 to anyone who is not an administrator (the screen's existence is not shown).
export default function AdminNotFound() {
  return (
    <div className="mx-auto w-full max-w-[600px] p-6">
      <h1 className="text-[length:var(--font-size-xl)] font-bold">ページが見つかりません</h1>
      <p className="mt-2 text-text-secondary">リンクが間違っているか、このページは存在しません。</p>
      <a href="/" className="mt-4 inline-block min-h-[var(--tap-min)] py-3 font-bold underline">
        ホームへ戻る
      </a>
    </div>
  );
}
