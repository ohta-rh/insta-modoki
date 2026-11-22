// Shown with HTTP 404 for a person with no story to see (none, expired, or no such user).
export default function StoryNotFound() {
  return (
    <div className="mx-auto w-full max-w-[600px] p-6">
      <h1 className="text-[length:var(--font-size-xl)] font-bold">ページが見つかりません</h1>
      <p className="mt-2 text-text-secondary">
        ストーリーが見つからないか、公開から 24 時間が過ぎた可能性があります。
      </p>
      <a href="/" className="mt-4 inline-block min-h-[var(--tap-min)] py-3 font-bold underline">
        ホームへ戻る
      </a>
    </div>
  );
}
