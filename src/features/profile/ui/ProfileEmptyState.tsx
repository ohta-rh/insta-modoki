/** Shown instead of the grid when the user has no posts. Only the owner is offered the way to post. */
export function ProfileEmptyState({ isMe }: { isMe: boolean }) {
  return (
    <section className="border-t border-border px-4 py-12 text-center">
      <p className="text-[length:var(--font-size-md)] font-bold">まだ投稿がありません</p>
      {isMe && (
        <a
          href="/create"
          className="mt-4 inline-flex min-h-[var(--tap-min)] items-center rounded-lg bg-text px-5 text-[length:var(--font-size-sm)] font-bold text-bg"
        >
          写真を投稿する
        </a>
      )}
    </section>
  );
}
