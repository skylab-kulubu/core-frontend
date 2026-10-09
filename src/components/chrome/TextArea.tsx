import { Textarea } from '@skylab-kulubu/skylcn-ui';
import type { TextareaHTMLAttributes } from 'react';

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea(props: TextAreaProps) {
  return <Textarea {...props} />;
}
