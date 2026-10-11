type FieldLabelProps = {
  children: string;
};

export function FieldLabel({ children }: FieldLabelProps) {
  return (
    <span className="text-3xs tracking-label text-subtle-foreground uppercase">{children}</span>
  );
}
