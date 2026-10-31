type FieldLabelProps = {
  children: string;
};

/** A field's name above it, in skylcn-ui's Field label style: plain case, not spaced capitals. */
export function FieldLabel({ children }: FieldLabelProps) {
  return <span className="text-2xs text-muted-foreground font-medium">{children}</span>;
}
