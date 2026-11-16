import { Button } from '@/components/ui';

export type AdminPickedFile = { name: string; size: number };
export type AdminFilePickerProps = { label: string; accept: string; onPick: (file: AdminPickedFile) => void };

// The admin prototype is web-only; native builds never render the upload form.
export function AdminFilePicker({ label }: AdminFilePickerProps) {
  return <Button label={label} variant="secondary" disabled onPress={() => {}} />;
}
