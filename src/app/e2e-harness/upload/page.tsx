import { notFound } from 'next/navigation';
import { UploadHarness } from '../../../features/media-upload/ui/UploadHarness';

// A screen for the E2E suite only (the picker and its result). It renders only when E2E_HARNESS=1 (set by playwright.config.ts alone) and never in production.
export default function UploadHarnessPage() {
  if (process.env.E2E_HARNESS !== '1' || process.env.APP_ENV === 'production') notFound();
  return (
    <div className="mx-auto w-full max-w-[480px] p-4">
      <h1 className="mb-4 text-[length:var(--font-size-xl)] font-bold">
        写真のアップロード（確認用）
      </h1>
      <UploadHarness />
    </div>
  );
}
