type FieldLabelProps = {
  children: string;
};

export function FieldLabel({ children }: FieldLabelProps) {
  return (
    <span className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">{children}</span>
  );
}
