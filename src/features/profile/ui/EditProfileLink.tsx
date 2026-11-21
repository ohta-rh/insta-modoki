/** The primary button on your own profile: a plain link, so it works before any script loads. */
export function EditProfileLink() {
  return (
    <a
      href="/accounts/edit"
      className="inline-flex min-h-[var(--tap-min)] items-center rounded-lg bg-surface px-4 text-[length:var(--font-size-sm)] font-bold"
    >
      プロフィールを編集
    </a>
  );
}
