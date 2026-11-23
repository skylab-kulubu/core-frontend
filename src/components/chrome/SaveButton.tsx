import { Button, buttonVariants, cn, type ButtonProps } from '@skylab-kulubu/skylcn-ui';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

/** The primary button's classes, for links and labels that should look like it. */
export const saveClass = cn(buttonVariants({ variant: 'primary' }), BUTTON_TEXT);

/** The form's main action: skylcn-ui's primary Button, submitting by default. */
export function SaveButton({ type = 'submit', className, ...props }: ButtonProps) {
  return (
    <Button
      variant="primary"
      type={type}
      className={
        typeof className === 'string' || !className ? cn(BUTTON_TEXT, className) : className
      }
      {...props}
    />
  );
}
