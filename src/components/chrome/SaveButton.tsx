import { Button, buttonVariants, type ButtonProps } from '@skylab-kulubu/skylcn-ui';

/** The primary button's classes, for links and labels that should look like it. */
export const saveClass = buttonVariants({ variant: 'primary' });

/** The form's main action: skylcn-ui's primary Button, submitting by default. */
export function SaveButton({ type = 'submit', ...props }: ButtonProps) {
  return <Button variant="primary" type={type} {...props} />;
}
