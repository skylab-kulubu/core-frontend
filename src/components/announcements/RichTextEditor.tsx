'use client';

import { cn } from '@skylab-kulubu/skylcn-ui';
import Link from '@tiptap/extension-link';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Field } from '@/components/chrome/Field';
import { linkHref } from '@/lib/news-editor';

/**
 * The same Tiptap set the CMS's own editor (inscribed SDK, use-rich-text-editor) uses, so a
 * body written here opens there unchanged and the reverse: StarterKit with h2/h3 and links.
 */
export const RICH_TEXT_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [2, 3] } }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: { rel: 'noopener noreferrer' },
  }),
];

/** Tiptap's empty page; stored as '' so an untouched editor is not a change. */
const EMPTY_DOC = '<p></p>';

/** How the body reads, in the editor and in the preview: the site's article type, small. */
export const RICH_TEXT_CLASS = cn(
  'text-foreground text-sm/6 outline-hidden',
  '[&_p]:my-2 [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold',
  '[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_blockquote]:border-border [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-secondary-foreground',
  '[&_a]:text-skylab-300 [&_a]:underline [&_code]:bg-muted [&_code]:rounded [&_code]:px-1',
  '[&_pre]:bg-muted [&_pre]:my-3 [&_pre]:rounded-md [&_pre]:p-3',
);

function ToolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active ?? undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'text-secondary-foreground hover:bg-accent hover:text-foreground grid size-8 place-items-center rounded-md disabled:opacity-40',
        active && 'bg-accent text-foreground',
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

function Toolbar({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const run = () => editor.chain().focus();
  return (
    <div
      role="toolbar"
      aria-label="Biçim"
      className="border-border-subtle flex flex-wrap items-center gap-0.5 border-b p-1"
      // Keeps the selection while a button is pressed
      onMouseDown={(event) => event.preventDefault()}
    >
      <ToolButton
        icon={Bold}
        label="Kalın"
        active={editor.isActive('bold')}
        onClick={() => run().toggleBold().run()}
      />
      <ToolButton
        icon={Italic}
        label="İtalik"
        active={editor.isActive('italic')}
        onClick={() => run().toggleItalic().run()}
      />
      <ToolButton
        icon={Strikethrough}
        label="Üstü çizili"
        active={editor.isActive('strike')}
        onClick={() => run().toggleStrike().run()}
      />
      <span className="bg-border-subtle mx-1 h-5 w-px" aria-hidden />
      <ToolButton
        icon={Heading2}
        label="Başlık"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => run().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        icon={Heading3}
        label="Alt başlık"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => run().toggleHeading({ level: 3 }).run()}
      />
      <span className="bg-border-subtle mx-1 h-5 w-px" aria-hidden />
      <ToolButton
        icon={List}
        label="Madde listesi"
        active={editor.isActive('bulletList')}
        onClick={() => run().toggleBulletList().run()}
      />
      <ToolButton
        icon={ListOrdered}
        label="Numaralı liste"
        active={editor.isActive('orderedList')}
        onClick={() => run().toggleOrderedList().run()}
      />
      <ToolButton
        icon={Quote}
        label="Alıntı"
        active={editor.isActive('blockquote')}
        onClick={() => run().toggleBlockquote().run()}
      />
      <ToolButton
        icon={LinkIcon}
        label="Bağlantı"
        active={editor.isActive('link')}
        onClick={onLink}
      />
      <span className="bg-border-subtle mx-1 h-5 w-px" aria-hidden />
      <ToolButton
        icon={Undo2}
        label="Geri al"
        disabled={!editor.can().undo()}
        onClick={() => run().undo().run()}
      />
      <ToolButton
        icon={Redo2}
        label="Yinele"
        disabled={!editor.can().redo()}
        onClick={() => run().redo().run()}
      />
    </div>
  );
}

/**
 * The announcement body: a Tiptap editor with a toolbar, writing HTML in the CMS's own
 * format. A link is set in a field under the toolbar, not a browser prompt.
 */
export function RichTextEditor({
  value,
  onChange,
  label,
  id,
}: {
  value: string;
  onChange: (html: string) => void;
  label: string;
  id?: string;
}) {
  const quiet = useRef(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkErrorId = useId();
  const editorProps = useMemo(
    () => ({
      attributes: {
        class: cn(RICH_TEXT_CLASS, 'min-h-64 px-3 py-2'),
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        ...(id ? { id } : {}),
      },
    }),
    [label, id],
  );
  const editor = useEditor({
    extensions: RICH_TEXT_EXTENSIONS,
    content: value || '',
    immediatelyRender: false,
    editorProps,
    onUpdate: ({ editor: current }) => {
      if (quiet.current) return;
      const html = current.getHTML();
      onChange(html === EMPTY_DOC ? '' : html);
    },
  });

  useEffect(() => {
    if (!editor) return undefined;
    quiet.current = false;
    return () => {
      quiet.current = true;
    };
  }, [editor]);

  // A value replaced from outside (a draft restored, changes thrown away) reaches the page
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || '';
    if (incoming === current || (incoming === '' && current === EMPTY_DOC)) return;
    quiet.current = true;
    editor.commands.setContent(incoming, false);
    quiet.current = false;
  }, [editor, value]);

  function openLink() {
    if (!editor) return;
    setHref((editor.getAttributes('link').href as string | undefined) ?? '');
    setLinkError(null);
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const next = linkHref(href);
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!next) chain.unsetLink().run();
    // The link extension refuses what it does not allow (javascript: and the like)
    else if (!chain.setLink({ href: next }).run()) {
      setLinkError('Bu adres bağlanamaz. https:// ile başlayan bir adres yaz.');
      return;
    }
    setLinkError(null);
    setLinkOpen(false);
  }

  return (
    <div className="border-border bg-background focus-within:ring-ring rounded-md border focus-within:ring-2">
      {editor ? <Toolbar editor={editor} onLink={openLink} /> : <div className="h-10" />}
      {linkOpen ? (
        <div className="border-border-subtle flex flex-wrap items-center gap-2 border-b p-2">
          <Field
            aria-label="Bağlantı adresi"
            placeholder="https://…"
            value={href}
            autoFocus
            aria-invalid={Boolean(linkError)}
            aria-describedby={linkError ? linkErrorId : undefined}
            className="min-w-48 flex-1"
            onChange={(event) => {
              setHref(event.target.value);
              setLinkError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyLink();
              }
              if (event.key === 'Escape') setLinkOpen(false);
            }}
          />
          <button
            type="button"
            className="text-foreground hover:bg-accent h-8 rounded-md px-3 text-[13px] font-medium"
            onClick={applyLink}
          >
            {href.trim() ? 'Bağla' : 'Bağlantıyı kaldır'}
          </button>
          {linkError ? (
            <p id={linkErrorId} role="alert" className="text-destructive w-full text-[13px]">
              {linkError}
            </p>
          ) : null}
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * The body as it will read, drawn by a read-only Tiptap with the same extensions: what the
 * schema does not know (a script, an inline handler) never reaches the page.
 */
export function RichTextView({ html }: { html: string }) {
  const editor = useEditor(
    {
      extensions: RICH_TEXT_EXTENSIONS,
      content: html || '',
      editable: false,
      immediatelyRender: false,
      editorProps: { attributes: { class: RICH_TEXT_CLASS } },
    },
    [html],
  );
  return <EditorContent editor={editor} />;
}
