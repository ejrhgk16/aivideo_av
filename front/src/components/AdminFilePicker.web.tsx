import { useRef } from 'react';
import { Button } from '@/components/ui';
import type { AdminFilePickerProps } from './AdminFilePicker';

// Only reads the chosen file's name and size; nothing is uploaded.
export function AdminFilePicker({ label, accept, onPick }: AdminFilePickerProps) {
  const input = useRef<HTMLInputElement>(null);
  return <>
    <Button label={label} variant="secondary" onPress={() => input.current?.click()} />
    <input ref={input} type="file" accept={accept} hidden onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      if (file) onPick({ name: file.name, size: file.size });
      event.currentTarget.value = '';
    }} />
  </>;
}
