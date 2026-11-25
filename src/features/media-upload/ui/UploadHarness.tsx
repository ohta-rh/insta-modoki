'use client';

import { useState } from 'react';
import type { UploadedImage } from '../model/upload-images';
import { ImagePicker } from './ImagePicker';

/** The check screen's body: the picker and what it returned, as JSON. */
export function UploadHarness() {
  const [images, setImages] = useState<UploadedImage[] | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <ImagePicker onUploaded={setImages} />
      {images !== null && (
        <pre
          data-testid="result"
          className="break-all whitespace-pre-wrap text-[length:var(--font-size-sm)]"
        >
          {JSON.stringify(images, null, 2)}
        </pre>
      )}
    </div>
  );
}
