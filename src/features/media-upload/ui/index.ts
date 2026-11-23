// The media-upload slice's entry for its screens and client components (ADR-0057). Only the routes and
// other slices' components import it; `../index.ts` stays free of `'use client'` modules.
export { ImagePicker, type ImagePickerProps } from './ImagePicker';
