type FieldLabelProps = {
  children: string;
};

/** A field's name above it, in skylcn-ui's Field label style: plain case, not spaced capitals. */
export function FieldLabel({ children }: FieldLabelProps) {
  return <span className="text-muted-foreground text-[13px]/5 font-medium">{children}</span>;
}
